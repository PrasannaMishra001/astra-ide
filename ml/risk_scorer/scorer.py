"""
Risk Scorer — maps a workload + user context to a sandbox tier.

Research basis: docs/research/01-adaptive-sandboxing.md (every factor, weight,
and threshold below is justified there with citations).

Model
-----
risk = Σ wᵢ · subscoreᵢ              (each subscore in [0,1]; weights sum to 1.0)

Factors (subscores), with default weights from the cited threat literature:
  code_signature   0.30   escape-vector primitives found via AST / token scan
  language         0.25   execution class (shell > interpreted+FFI > managed)
  user_trust       0.20   inverted trust — defines the "untrusted code" case
  network          0.15   exfiltration / second-stage payloads
  filesystem_write 0.10   persistence precondition

Tier thresholds tied to MEASURED overhead crossovers (Section 1.1 of the doc):
  risk < 0.30   → runc          below gVisor's ~18% syscall break-even
  risk < 0.70   → gVisor        user-space kernel, right risk/cost middle
  risk >= 0.70  → firecracker    hardware boundary; NSDI-measured <125ms / <5MiB

The class is fully configurable so the Week-6 ablation study can sweep weights
and thresholds. This is the canonical implementation; the backend keeps a thin
duplicate (kept in sync) to avoid importing the ml package into its container.
"""
from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from typing import Iterable

SANDBOX_TIERS = ("runc", "gvisor", "firecracker")


# ── Language execution classes ────────────────────────────────────────────────
# Shell-class: can issue arbitrary host commands directly (escape end-stage).
# Interpreted+FFI: can reach syscalls via ctypes/child processes.
# Managed/compiled: sandboxed-by-default execution model.
_SHELL_LANGS    = frozenset({"bash", "sh", "shell", "zsh", "ksh", "powershell", "ps1"})
_INTERP_FFI     = frozenset({"python", "py", "javascript", "js", "node", "ruby", "perl", "php", "lua"})
_MANAGED_LANGS  = frozenset({"go", "rust", "java", "cpp", "c++", "c", "csharp", "kotlin", "scala", "typescript", "ts"})

LANG_SCORE_SHELL   = 1.0
LANG_SCORE_INTERP  = 0.5
LANG_SCORE_MANAGED = 0.2
LANG_SCORE_UNKNOWN = 0.5


# ── Escape-vector signatures (docs/research §2.5) ─────────────────────────────
# HIGH = direct escape / arbitrary host exec; MEDIUM = enabling primitive.
# Severity contributes to the code-signature subscore (capped at 1.0).
_HIGH_SEVERITY = 0.50
_MED_SEVERITY  = 0.25

# Shell tokens (word-boundary matched). Maps token -> severity.
_SHELL_VECTORS: dict[str, float] = {
    # namespace / mount escapes (CVE-2022-0185, chroot breakout)
    "unshare":       _HIGH_SEVERITY,
    "nsenter":       _HIGH_SEVERITY,
    "setns":         _HIGH_SEVERITY,
    "pivot_root":    _HIGH_SEVERITY,
    "mount":         _HIGH_SEVERITY,
    "umount":        _MED_SEVERITY,
    # kernel module loading
    "insmod":        _HIGH_SEVERITY,
    "modprobe":      _MED_SEVERITY,
    "init_module":   _HIGH_SEVERITY,
    # cgroup release_agent escape (CVE-2022-0492)
    "release_agent": _HIGH_SEVERITY,
    # runtime socket / runc overwrite (CVE-2019-5736)
    "docker.sock":   _HIGH_SEVERITY,
    "/proc/self/exe": _HIGH_SEVERITY,
    # destructive / persistence
    "rm -rf /":      _MED_SEVERITY,
    "chmod 777":     _MED_SEVERITY,
    "mknod":         _MED_SEVERITY,
    "dd if=":        _MED_SEVERITY,
}

# Strings that are escape vectors regardless of language
_GENERIC_VECTORS: dict[str, float] = {
    "release_agent":  _HIGH_SEVERITY,
    "docker.sock":    _HIGH_SEVERITY,
    "/proc/self/exe": _HIGH_SEVERITY,
    "/var/run/docker": _HIGH_SEVERITY,
}

# Python modules whose import signals host-reach capability (severity on USE).
_PY_DANGEROUS_MODULES = {
    "ctypes":     _HIGH_SEVERITY,   # raw memory / direct syscall
    "pty":        _HIGH_SEVERITY,   # interactive shell spawn
    "subprocess": _MED_SEVERITY,    # child process (HIGH if shell=True, handled below)
    "socket":     _MED_SEVERITY,    # raw network
}

# Python builtins / calls that are escape-grade.
_PY_DANGEROUS_CALLS = {
    "eval":   _HIGH_SEVERITY,
    "exec":   _HIGH_SEVERITY,
    "compile": _MED_SEVERITY,
    "__import__": _MED_SEVERITY,
}

# Python os.* functions that exec or fork.
_PY_OS_DANGEROUS = {
    "system":   _HIGH_SEVERITY,
    "popen":    _HIGH_SEVERITY,
    "execv":    _HIGH_SEVERITY, "execve": _HIGH_SEVERITY, "execl": _HIGH_SEVERITY,
    "execlp":   _HIGH_SEVERITY, "execvp": _HIGH_SEVERITY,
    "fork":     _MED_SEVERITY,
    "setuid":   _HIGH_SEVERITY, "setgid": _HIGH_SEVERITY,
    "fchmod":   _MED_SEVERITY,
}


@dataclass
class WorkloadRequest:
    """All inputs needed to score a workload's risk."""
    language:         str
    network_access:   bool  = False
    filesystem_write: bool  = True
    user_trust:       float = 0.5    # [0,1], higher = more trusted
    code_snippet:     str   = ""


@dataclass
class ScoreBreakdown:
    """Transparent per-factor breakdown — fed to the activity feed for audit."""
    language:         float
    network:          float
    filesystem_write: float
    user_trust:       float
    code_signature:   float
    total:            float
    tier:             str
    matched_vectors:  tuple[str, ...]

    def explain(self) -> str:
        parts = [
            f"lang={self.language:.2f}",
            f"net={self.network:.2f}",
            f"fs={self.filesystem_write:.2f}",
            f"trust={self.user_trust:.2f}",
            f"code={self.code_signature:.2f}",
        ]
        s = " ".join(parts) + f" -> risk={self.total:.2f} -> {self.tier}"
        if self.matched_vectors:
            s += f" [vectors: {', '.join(self.matched_vectors)}]"
        return s


@dataclass
class RiskScorer:
    """
    Configurable risk scorer. Default weights/thresholds are the cited defaults
    from docs/research/01-adaptive-sandboxing.md. Override any field for the
    ablation study.
    """
    # Weights — sum to 1.0 (see research doc §3)
    weight_code_scan:  float = 0.30
    weight_language:   float = 0.25
    weight_user_trust: float = 0.20
    weight_network:    float = 0.15
    weight_fs_write:   float = 0.10

    # Tier thresholds — overhead crossover points (research doc §3.1)
    threshold_runc_to_gvisor: float = 0.30
    threshold_gvisor_to_fc:   float = 0.70

    # ── Public API ─────────────────────────────────────────────────────────────

    def score(self, req: WorkloadRequest) -> float:
        return self.score_detailed(req).total

    def select_tier(self, risk_score: float) -> str:
        if risk_score < self.threshold_runc_to_gvisor:
            return "runc"
        if risk_score < self.threshold_gvisor_to_fc:
            return "gvisor"
        return "firecracker"

    def score_and_select(self, req: WorkloadRequest) -> tuple[float, str]:
        b = self.score_detailed(req)
        return b.total, b.tier

    def score_detailed(self, req: WorkloadRequest) -> ScoreBreakdown:
        lang_sub  = self._language_subscore(req.language)
        net_sub   = 1.0 if req.network_access else 0.0
        fs_sub    = 1.0 if req.filesystem_write else 0.0
        trust_sub = max(0.0, min(1.0, 1.0 - req.user_trust))     # inverted, clamped
        code_sub, vectors = self._code_signature_subscore(req.code_snippet, req.language)

        total = (
            self.weight_code_scan  * code_sub +
            self.weight_language   * lang_sub +
            self.weight_user_trust * trust_sub +
            self.weight_network    * net_sub +
            self.weight_fs_write   * fs_sub
        )
        total = max(0.0, min(total, 1.0))
        return ScoreBreakdown(
            language=lang_sub, network=net_sub, filesystem_write=fs_sub,
            user_trust=trust_sub, code_signature=code_sub,
            total=total, tier=self.select_tier(total),
            matched_vectors=vectors,
        )

    def score_batch(self, requests: Iterable[WorkloadRequest]) -> list[float]:
        return [self.score(r) for r in requests]

    # ── Subscore helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _language_subscore(language: str) -> float:
        lang = (language or "").lower().strip()
        if lang in _SHELL_LANGS:
            return LANG_SCORE_SHELL
        if lang in _INTERP_FFI:
            return LANG_SCORE_INTERP
        if lang in _MANAGED_LANGS:
            return LANG_SCORE_MANAGED
        return LANG_SCORE_UNKNOWN

    def _code_signature_subscore(self, code: str, language: str) -> tuple[float, tuple[str, ...]]:
        """
        Returns (subscore in [0,1], matched vector names).
        Uses AST analysis for Python (no false positives from comments/strings);
        falls back to a word-boundary token scan for shell and unparseable code.
        """
        if not code or not code.strip():
            return 0.0, ()

        lang = (language or "").lower().strip()
        severity_total = 0.0
        matched: list[str] = []

        # Generic escape strings apply to any language
        lowered = code.lower()
        for vec, sev in _GENERIC_VECTORS.items():
            if vec in lowered:
                severity_total += sev
                matched.append(vec)

        if lang in ("python", "py"):
            ast_sev, ast_matched = self._scan_python_ast(code)
            severity_total += ast_sev
            matched.extend(ast_matched)
        else:
            tok_sev, tok_matched = self._scan_shell_tokens(code)
            severity_total += tok_sev
            matched.extend(tok_matched)

        # De-dup while preserving order
        seen: set[str] = set()
        uniq = tuple(m for m in matched if not (m in seen or seen.add(m)))
        return min(severity_total, 1.0), uniq

    @staticmethod
    def _scan_python_ast(code: str) -> tuple[float, list[str]]:
        """Real call/import detection — ignores comments and string literals."""
        try:
            tree = ast.parse(code)
        except SyntaxError:
            # Partial/invalid snippet — fall back to token scan
            return RiskScorer._scan_shell_tokens(code)

        sev = 0.0
        matched: list[str] = []

        for node in ast.walk(tree):
            # import ctypes / import subprocess / import socket / import pty
            if isinstance(node, ast.Import):
                for alias in node.names:
                    root = alias.name.split(".")[0]
                    if root in _PY_DANGEROUS_MODULES:
                        sev += _PY_DANGEROUS_MODULES[root]
                        matched.append(f"import {root}")
            elif isinstance(node, ast.ImportFrom):
                root = (node.module or "").split(".")[0]
                if root in _PY_DANGEROUS_MODULES:
                    sev += _PY_DANGEROUS_MODULES[root]
                    matched.append(f"from {root}")

            # Calls: eval(), exec(), os.system(), subprocess.run(shell=True), ...
            elif isinstance(node, ast.Call):
                name = _call_name(node.func)
                if name in _PY_DANGEROUS_CALLS:
                    sev += _PY_DANGEROUS_CALLS[name]
                    matched.append(f"{name}()")
                # os.<func>
                if isinstance(node.func, ast.Attribute):
                    attr = node.func.attr
                    base = _call_name(node.func.value)
                    if base == "os" and attr in _PY_OS_DANGEROUS:
                        sev += _PY_OS_DANGEROUS[attr]
                        matched.append(f"os.{attr}()")
                    # subprocess.*(shell=True) is escape-grade
                    if base == "subprocess":
                        shell_true = any(
                            isinstance(kw, ast.keyword) and kw.arg == "shell"
                            and isinstance(kw.value, ast.Constant) and kw.value.value is True
                            for kw in node.keywords
                        )
                        if shell_true:
                            sev += _HIGH_SEVERITY
                            matched.append("subprocess(shell=True)")

        return sev, matched

    @staticmethod
    def _scan_shell_tokens(code: str) -> tuple[float, list[str]]:
        """Word-boundary token scan for shell escape primitives."""
        sev = 0.0
        matched: list[str] = []
        lowered = code.lower()
        for vec, s in _SHELL_VECTORS.items():
            # Multi-word / path vectors: plain substring; single tokens: word boundary
            if " " in vec or "/" in vec or "." in vec:
                hit = vec in lowered
            else:
                hit = re.search(rf"\b{re.escape(vec)}\b", lowered) is not None
            if hit:
                sev += s
                matched.append(vec)
        return sev, matched


# ── module-level helper ───────────────────────────────────────────────────────

def _call_name(node: ast.AST) -> str:
    """Best-effort dotted name of a call target ('os', 'os.system', 'eval')."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


# Backwards-compatible default instance for quick use
default_scorer = RiskScorer()

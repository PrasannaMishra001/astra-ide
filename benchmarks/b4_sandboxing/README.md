# B4 Sandboxing — Benchmark Evaluation (policy gate)

External-data evaluation of the **policy gate** (Paper 1, Yan arXiv:2512.12806
§4.2) that is wired live into `executor_service.execute()`. Complements the unit
tests (which reproduce Paper 1's Table 1 on constructed inputs) by measuring the
*same code path* against an independent, real-world command corpus.

## What the gate is for (threat model)

The gate is a **precision-first safety filter for untrusted code run in a
sandbox**. It blocks the unambiguous, high-severity operations — filesystem /
device destruction, container escape, fork bombs — and lets everything else run
(SAFE directly, UNCERTAIN under snapshot/rollback). It is deliberately **not** a
general malware / injection / C2 classifier; those behavioural threats are the
job of the graph IDS (Paper 3) and network policy. So the right questions are:

1. **Does it stay out of a developer's way?** → FPR on real benign commands.
2. **Does it block what it targets?** → recall on destructive/escape/fork-bomb.

## Datasets

| Role | Source | Size | Why |
|---|---|---|---|
| Benign | **NL2Bash** (`TellinaTool/nl2bash`, real developer bash) | 10,624 dedup | Measures FPR on real coding commands |
| Malicious (in-scope) | **SandboxEscapeBench** (Paper 2, CVE-mapped) + canonical destructive ops | 21 | Measures recall on the gate's design scope |

**Dataset we evaluated and *rejected* (important):**
`AmirAliGharesoufloo/CommandInjection` (HuggingFace, Sept 2025) looked relevant
by name but is a **WAF / web-input dataset** — its "benign" rows are names and
postal addresses and its "malicious" rows are HTML/URL-encoded HTTP injection
payloads (only 5/515 contain a shell destructive/escape token). That is the
wrong threat model for a code-execution sandbox, so it is **not** used here.
*Recency alone does not make a benchmark valid — it must match the threat model.*

For the broader behavioural threats (reverse shells), the recent **QuasarNix**
LOTL corpus (`dtrizna/QuasarNix`, 1M+ variants, 2024) is the right fit and is
reserved for the IDS benchmark, not the gate.

## Reproduce

```bash
cd benchmarks/b4_sandboxing
python make_policy_gate_set.py                 # downloads NL2Bash, writes data/policy_gate_eval.csv
python eval_policy_gate.py --csv data/policy_gate_eval.csv --out results/policy_gate_report.json
```

## Results

```
                     Precision  Recall    F1     FPR     Accuracy
  policy gate          0.800    0.952   0.870   0.0005   0.999
  naive baseline       0.002    0.667   0.004   0.636    0.364
```

Coverage map (recall on the malicious subset, by technique):

```
  escape        10/10   1.00
  destructive    9/9    1.00
  forkbomb       1/2    0.50
```

## Analysis (honest)

- **FPR ≈ 0 on 10,624 real commands.** The gate blocks normal coding essentially
  never — the precision property Paper 1 claims, shown on external data.
- **The 5 "false positives" are all privileged device/socket ops**
  (`dd of=/dev/sdb …`, `chown … /var/run/docker.sock`). These are legitimate for
  a *sysadmin* but are exactly what untrusted sandbox code must **not** do, so
  they are intentional blocks. FPR on ordinary developer commands is **0**.
- **The naive baseline** (block on any of `rm/;/|/sudo/…`) catches a hair more
  malicious (R=0.67) but blocks **64%** of real commands (FPR=0.636) — useless in
  practice. This is what the structured policy buys: comparable recall at
  ~1000× lower false-positive rate.
- **The benchmark drove a real fix.** First run scored recall **0.62**: it missed
  `rm -rf --no-preserve-root /` (long flag between `-rf` and `/`), `nsenter`,
  host-root `docker -v /:/`, `/proc/sysrq-trigger`, dangerous `unshare`,
  `shred /etc/…`, `mv … /dev/null`. Closing those (no new false positives) lifted
  recall to **0.95** — see the `TestBenchmarkDerivedPatterns` regression tests.
- **The one remaining miss** (`while true; do mkdir x; cd x; done`) is an
  arbitrary resource-exhaustion loop. Detecting it statically is undecidable and
  would cause false positives on legitimate loops; it is correctly handled at
  runtime by cgroup limits (sandbox tier) + the behavioural IDS, **not** the
  static gate. We leave it as an honest miss rather than over-fit.

## What this validates / what's next

- **Validates:** Paper 1 §4.2 policy engine — 100% block of in-scope destructive/
  escape on external data, at ~0 FPR on 10.6k real commands.
- **Next (needs syscall data):** the graph IDS (Paper 3) reproduced on LID-DS-2021
  / QuasarNix — that is where a headline F1 (0.78–0.99) gets reproduced. ASTRA's
  own eBPF layer (B2) will later produce a fresh 2025 syscall corpus.

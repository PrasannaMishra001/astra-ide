"""
B1 — Kaggle notebook: train the PF-MPPO scheduler on the REAL Google Cluster
Trace 2011 and export the served artifact (model.pt + metrics.json).

HOW TO USE ON KAGGLE
--------------------
1. New Kaggle Notebook → Settings → Accelerator: GPU T4 (optional; CPU also works,
   just slower) → Internet: ON.
2. Paste this file's cells in order (or run as a script). It:
     a. clones the ASTRA-IDE repo,
     b. downloads a SUBSET of the real Google trace over HTTP (no gsutil/auth
        needed) — a few task_events parts + machine_events,
     c. pretrains + fine-tunes PF-MPPO in trace_hybrid mode,
     d. evaluates vs Round-Robin / Random / FIFO / Least-Loaded,
     e. writes ml/scheduler/pfmppo/artifacts/{model.pt,metrics.json}.
3. Download the `artifacts/` folder (it's small — a few KB) from the Kaggle output
   and commit it to the repo, OR paste me metrics.json + attach model.pt.

You do NOT download the trace to your PC — it lives only inside Kaggle's disk.
Bump N_TASK_PARTS / ITERS for a stronger model (more data + more training).
"""

# ── Cell 1: clone repo + install deps ─────────────────────────────────────────
import os, subprocess, sys, json, shutil, urllib.request
from pathlib import Path

REPO = "https://github.com/PrasannaMishra001/astra-ide.git"   # make public first, or use Kaggle "Add Data"
WORK = Path("/kaggle/working/astra-ide")
if not WORK.exists():
    subprocess.run(["git", "clone", "--depth", "1", REPO, str(WORK)], check=True)
os.chdir(WORK)
subprocess.run([sys.executable, "-m", "pip", "install", "-q",
                "torch", "gymnasium", "numpy", "pandas"], check=True)

# ── Cell 2: download a SUBSET of the real Google Cluster Trace 2011 ────────────
# Public HTTP mirror of gs://clusterdata-2011-2/ — no auth needed.
BASE = "https://storage.googleapis.com/clusterdata-2011-2"
DATA = WORK / "data" / "google_trace"
(DATA / "machine_events").mkdir(parents=True, exist_ok=True)
(DATA / "task_events").mkdir(parents=True, exist_ok=True)

N_TASK_PARTS = 10          # of 500; 10 parts ≈ plenty for a good policy. Raise for more.

def _get(url, dest):
    if Path(dest).exists() and Path(dest).stat().st_size > 0:
        return
    print("downloading", url)
    urllib.request.urlretrieve(url, dest)

_get(f"{BASE}/machine_events/part-00000-of-00001.csv.gz",
     DATA / "machine_events" / "part-00000-of-00001.csv.gz")
for i in range(N_TASK_PARTS):
    part = f"part-{i:05d}-of-00500.csv.gz"
    _get(f"{BASE}/task_events/{part}", DATA / "task_events" / part)
print("trace subset ready:", DATA)

# ── Cell 3: pretrain + fine-tune on the real trace ────────────────────────────
CFG   = "ml/scheduler/pfmppo/configs/4_nodes.json"
ITERS = 3000                # raise to 5000+ for the final model
WORKERS = os.cpu_count() or 4
OUT = WORK / "runs" / "pfmppo_full"

subprocess.run([sys.executable, "-m", "ml.scheduler.pfmppo.train",
    "--mode", "pretrain", "--config", CFG,
    "--dag-mode", "trace_hybrid", "--data-dir", str(DATA), "--max-files", "0",
    "--iterations", str(ITERS), "--workers", str(WORKERS),
    "--batch-size", "1000", "--num-tasks", "40", "--max-steps", "300",
    "--out", str(OUT)], check=True)

OUT_FT = WORK / "runs" / "pfmppo_full_ft"
subprocess.run([sys.executable, "-m", "ml.scheduler.pfmppo.train",
    "--mode", "finetune", "--model-path", str(OUT / "model.pt"),
    "--config", CFG, "--dag-mode", "trace_hybrid", "--data-dir", str(DATA),
    "--max-files", "0", "--iterations", str(ITERS // 2), "--workers", str(WORKERS),
    "--lr", "0.0001", "--out", str(OUT_FT)], check=True)

# ── Cell 4: evaluate vs baselines ─────────────────────────────────────────────
MODEL = OUT_FT / "model.pt"
eval_out = subprocess.run([sys.executable, "benchmarks/b1_scheduler/eval_pfmppo.py",
    "--model-path", str(MODEL), "--eval-episodes", "50", "--num-tasks", "20"],
    capture_output=True, text=True)
print(eval_out.stdout[-3000:])
print(eval_out.stderr[-1000:])

# ── Cell 5: export the committable artifact ───────────────────────────────────
ART = WORK / "ml" / "scheduler" / "pfmppo" / "artifacts"
ART.mkdir(parents=True, exist_ok=True)
shutil.copy(MODEL, ART / "model.pt")
(ART / "metrics.json").write_text(json.dumps({
    "dataset": "Google-Cluster-Trace-2011 (clusterdata-2011-2)",
    "task_parts_used": N_TASK_PARTS,
    "iterations_pretrain": ITERS, "iterations_finetune": ITERS // 2,
    "config": "4_nodes", "dag_mode": "trace_hybrid",
    "eval_stdout_tail": eval_out.stdout[-2000:],
    "note": "paste the eval table numbers (PPO vs RR/Random/FIFO/Least-Loaded) here",
}, indent=2))
print("\nARTIFACT READY -> download /kaggle/working/astra-ide/ml/scheduler/pfmppo/artifacts/")
print("Commit model.pt + metrics.json; backend already defaults to it (SCHEDULER_ALGORITHM=pfmppo).")

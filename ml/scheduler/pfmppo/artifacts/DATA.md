# PF-MPPO model artifact provenance

- **model.pt** — trained PF-MPPO (PPO) scheduler policy.
- **metrics.json** — training config + evaluation numbers.

## Training
- **Dataset:** Google Cluster Trace 2011 (`clusterdata-2011-2`), the public production trace
  (~12.5k machines, 29 days). Loaded via `ml/scheduler/pfmppo/google_trace_loader.py`.
- **Mode:** `trace_hybrid` (70% real trace tasks + 30% synthetic random DAGs).
- **Iterations:** 3000 pretrain + 1500 fine-tune. (The paper's canonical N is 2000; we trained
  longer for extra convergence.)
- **Config:** `configs/4_nodes.json`, K=10, gamma 0.9, clip 0.2, lr 0.001 (pretrain) / 0.0001
  (fine-tune), Adam, ReLU. Reward weights 0.60/0.20/0.20 (IDE-latency emphasis; the paper uses
  roughly equal thirds, see `math_models.pfmppo_reward`).
- Trained on Kaggle (CPU; the policy net is ~8k params, GPU gives no benefit).

## Evaluation
- The served/local eval (`benchmarks/b1_scheduler/eval_pfmppo.py --model-path`) compares PF-MPPO
  vs Random and Greedy-priority on identical workloads (paired, same seeds).
- **In-distribution results belong to `trace_hybrid` mode** (the trace lives on Kaggle); the local
  `random`-mode number is a generalization check. Template mode is out-of-distribution for this
  model (trace_hybrid training does not include the IDE templates), so it is not a fair baseline.
- See `metrics.json.eval` for the recorded numbers.

## To refresh
Re-run `notebooks/b1_scheduler_kaggle.py` on Kaggle (Cell 5 evaluates in `trace_hybrid` mode) and
recommit `model.pt` + `metrics.json`.

"""
B3 benchmark — LSTM invocation forecasting + cold-start reduction on the real
Azure Functions 2019 trace (Shahrad et al.), reproducing the LSTM baseline of the
Transformer cold-start paper (Tables I/II) and the cold-start reduction (Table III).

For a spread of real HTTP-triggered functions it:
  1. trains the LSTM on each function's per-minute invocation series and reports
     sMAPE / N-RMSE / R² on a held-out tail  → compare to the paper's LSTM rows
     (well-behaved series: sMAPE ~0.10-0.17, N-RMSE ~0.12-0.18);
  2. compares cold starts under fixed-10-min vs Shahrad hybrid-histogram vs
     oracle-adaptive keep-alive  → reduction band (paper Table III: ~50-80%).

    python eval_azure.py --csv data/_extracted/invocations_per_function_md.anon.d01.csv \
        --n-functions 8 --input-len 60 --epochs 60
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO))
from ml.prewarming.forecaster import InvocationForecaster, persistence_forecast, smape  # noqa: E402
from ml.prewarming import policy as P                                                    # noqa: E402

try:
    import pandas as pd
except ImportError:
    sys.exit("pandas required: pip install -r ml/requirements.txt")

_MINUTE_COLS = [str(i) for i in range(1, 1441)]


def _load_http_functions(csv: Path, n: int, seed: int) -> list[tuple[str, np.ndarray]]:
    df = pd.read_csv(csv)
    df = df[df["Trigger"] == "http"]
    series = df[_MINUTE_COLS].to_numpy(dtype=float)
    totals = series.sum(axis=1)
    active = (series > 0).sum(axis=1)
    # Keep functions with enough signal to forecast (paper focuses on these).
    keep = np.where((totals >= 300) & (active >= 120))[0]
    if len(keep) == 0:
        sys.exit("no sufficiently-active HTTP functions found in this day file")
    # Spread across activity levels (like the paper's cluster representatives).
    keep = keep[np.argsort(totals[keep])]
    idx = np.linspace(0, len(keep) - 1, min(n, len(keep))).round().astype(int)
    return [(f"fn{j}", series[keep[i]]) for j, i in enumerate(idx)]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--csv", required=True, type=Path)
    ap.add_argument("--n-functions", type=int, default=8)
    ap.add_argument("--input-len", type=int, default=60)
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    funcs = _load_http_functions(args.csv, args.n_functions, args.seed)
    print(f"Selected {len(funcs)} HTTP functions from {args.csv.name}\n")
    print("Forecasting (LSTM vs naive persistence)  |  paper LSTM: sMAPE~0.10-0.17, N-RMSE~0.12-0.18")
    print(f"{'fn':5} {'tot':>7} {'LSTM sMAPE':>11} {'N-RMSE':>8} {'R2':>7} {'naive sMAPE':>12}")

    sm, nr, beats = [], [], 0
    cold_rows = []
    for name, s in funcs:
        split = int(len(s) * 0.8)
        train, tail = s[:split], s[split - args.input_len:]
        f = InvocationForecaster(input_len=args.input_len, hidden=32, layers=2,
                                 epochs=args.epochs, lr=1e-2, seed=args.seed).fit(train)
        m = f.evaluate(tail)
        y, yh = persistence_forecast(tail, args.input_len, 1)
        naive = smape(y[:, 0], yh[:, 0])
        sm.append(m["smape"]); nr.append(m["n_rmse"]); beats += int(m["smape"] < naive)
        print(f"{name:5} {int(s.sum()):7d} {m['smape']:11.3f} {m['n_rmse']:8.3f} "
              f"{m['r2']:7.3f} {naive:12.3f}")

        # Cold-start reduction: fixed-10 vs hybrid-histogram vs oracle-adaptive.
        fixed = P.simulate_cold_starts(s, P.DEFAULT_WINDOW)["cold_starts"]
        hist = P.simulate_cold_starts(s, P.hybrid_histogram_keep_alive(s))["cold_starts"]
        oracle = P.simulate_cold_starts(s, P.oracle_keep_alive(s))["cold_starts"]
        cold_rows.append((name, fixed, hist, oracle))

    print(f"\nForecasting summary: median LSTM sMAPE={np.median(sm):.3f}  "
          f"median N-RMSE={np.median(nr):.3f}  beats-naive {beats}/{len(funcs)}")

    print("\nCold starts per function (lower better)  |  paper Table III: adaptive 50-80% fewer")
    print(f"{'fn':5} {'fixed10':>8} {'hybrid':>8} {'oracle':>8} {'hist red%':>10} {'oracle red%':>12}")
    tf = th = to = 0
    for name, fixed, hist, oracle in cold_rows:
        hr = 100 * (fixed - hist) / fixed if fixed else 0
        orr = 100 * (fixed - oracle) / fixed if fixed else 0
        tf += fixed; th += hist; to += oracle
        print(f"{name:5} {fixed:8d} {hist:8d} {oracle:8d} {hr:10.1f} {orr:12.1f}")
    print(f"\nTotals: fixed={tf} hybrid={th} oracle={to}  |  "
          f"hybrid cuts {100*(tf-th)/tf:.1f}%, oracle cuts {100*(tf-to)/tf:.1f}% vs fixed-10")


if __name__ == "__main__":
    main()

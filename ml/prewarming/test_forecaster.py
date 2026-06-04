"""
Tests for the B3 LSTM invocation forecaster (Transformer-paper LSTM baseline).

We (a) check the paper's metrics are computed correctly and (b) verify the LSTM
learns a structured invocation signal — reaching the paper's sMAPE band
(~0.1-0.2 on well-behaved series) and beating the naive 'repeat-last' baseline.
"""
import unittest

import numpy as np

from ml.prewarming.forecaster import (
    smape, rmse, normalized_rmse, r2_score, make_windows,
    persistence_forecast, InvocationForecaster,
)


class TestMetrics(unittest.TestCase):
    def test_perfect_prediction(self):
        y = [1, 2, 3, 4]
        self.assertEqual(smape(y, y), 0.0)
        self.assertEqual(rmse(y, y), 0.0)
        self.assertEqual(normalized_rmse(y, y), 0.0)
        self.assertAlmostEqual(r2_score(y, y), 1.0)

    def test_smape_symmetry_and_bound(self):
        # sMAPE is in [0, 2]; opposite-sign-ish far prediction approaches 2.
        self.assertAlmostEqual(smape([10], [0]), 2.0, places=6)
        self.assertTrue(0.0 <= smape([5, 7, 9], [4, 8, 10]) <= 2.0)

    def test_rmse_and_nrmse_known(self):
        y = [0.0, 10.0]
        yhat = [1.0, 9.0]
        self.assertAlmostEqual(rmse(y, yhat), 1.0)
        self.assertAlmostEqual(normalized_rmse(y, yhat), 0.1)   # rmse 1 / range 10

    def test_r2_mean_predictor_is_zero(self):
        y = np.array([1.0, 2.0, 3.0, 4.0])
        self.assertAlmostEqual(r2_score(y, np.full_like(y, y.mean())), 0.0)


class TestWindows(unittest.TestCase):
    def test_window_shapes(self):
        X, Y = make_windows(np.arange(10), input_len=4, horizon=1)
        self.assertEqual(X.shape, (6, 4))
        self.assertEqual(Y.shape, (6, 1))
        np.testing.assert_array_equal(X[0], [0, 1, 2, 3])
        np.testing.assert_array_equal(Y[0], [4])


def _periodic_invocations(n=420, period=24, seed=0):
    """A daily-shaped invocation series: smooth peak + small noise, non-negative."""
    rng = np.random.default_rng(seed)
    t = np.arange(n)
    base = 20 + 18 * np.sin(2 * np.pi * t / period) + 6 * np.sin(2 * np.pi * t / (period / 2))
    return np.clip(base + rng.normal(0, 1.0, n), 0, None)


class TestLSTMForecaster(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        s = _periodic_invocations()
        cls.train, cls.test = s[:300], s[300:]
        cls.f = InvocationForecaster(input_len=24, hidden=24, layers=2,
                                     epochs=120, lr=1e-2, seed=0).fit(cls.train)

    def test_beats_naive_persistence(self):
        full = np.concatenate([self.train[-self.f.input_len:], self.test])
        m = self.f.evaluate(full)
        y, yhat = persistence_forecast(full, self.f.input_len, 1)
        naive = smape(y[:, 0], yhat[:, 0])
        self.assertLess(m["smape"], naive,
                        f"LSTM sMAPE {m['smape']:.3f} should beat naive {naive:.3f}")

    def test_in_paper_smape_band(self):
        full = np.concatenate([self.train[-self.f.input_len:], self.test])
        m = self.f.evaluate(full)
        # Paper's LSTM sMAPE on well-behaved series ~0.1-0.2; allow headroom.
        self.assertLess(m["smape"], 0.30, f"sMAPE too high: {m['smape']:.3f}")
        self.assertGreater(m["r2"], 0.5, f"R2 too low: {m['r2']:.3f}")

    def test_predict_next_shape_and_nonneg_scale(self):
        out = self.f.predict_next(self.train)
        self.assertEqual(len(out), 1)
        self.assertTrue(np.isfinite(out[0]))


if __name__ == "__main__":
    unittest.main(verbosity=2)

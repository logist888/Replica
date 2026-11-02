import math
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from rasch import calibrate_jml, eap, p_correct  # noqa: E402
from mst import Panel  # noqa: E402


class RaschTests(unittest.TestCase):
    def test_probability_is_half_at_equal_ability(self):
        self.assertAlmostEqual(p_correct(1.0, 1.0), 0.5)

    def test_eap_moves_with_answers(self):
        easy = [(-1.0, 1)] * 5
        hard = [(2.0, 1)] * 5
        t_easy, _ = eap(easy)
        t_hard, _ = eap(hard)
        self.assertGreater(t_hard, t_easy)
        self.assertLess(eap([(0.0, 0)] * 5)[0], 0)

    def test_eap_empty_returns_prior(self):
        self.assertEqual(eap([]), (0.0, 2.0))

    def test_calibration_recovers_order_of_difficulty(self):
        rng = random.Random(1)
        bank = [-2, -1, 0, 1, 2]
        resp = []
        for p in range(400):
            th = rng.gauss(0, 1.2)
            for i, b in enumerate(bank):
                resp.append((p, i, 1 if rng.random() < p_correct(th, b) else 0))
        b, _, se = calibrate_jml(resp)
        est = [b[i] for i in range(5)]
        self.assertEqual(est, sorted(est))
        self.assertAlmostEqual(sum(est) / 5, 0.0, places=6)
        for i in range(5):
            self.assertGreater(se[i], 0)

    def test_empty_or_all_extreme_data_returns_empty(self):
        self.assertEqual(calibrate_jml([]), ({}, {}, {}))
        self.assertEqual(calibrate_jml([(0, 0, 1), (1, 0, 1)]), ({}, {}, {}))

    def test_extreme_persons_are_dropped_not_crashing(self):
        resp = [(0, 0, 1), (0, 1, 1), (1, 0, 0), (1, 1, 0), (2, 0, 1), (2, 1, 0), (3, 0, 0), (3, 1, 1)]
        b, theta, _ = calibrate_jml(resp)
        self.assertNotIn(0, theta)
        self.assertNotIn(1, theta)


class MstTests(unittest.TestCase):
    def make_panel(self):
        m = lambda t: [t - 0.2, t, t + 0.2]
        return Panel([m(0)], [m(-1.2), m(0), m(1.2)], [m(-2), m(-0.7), m(0.7), m(2)],
                     cut1=[-0.6, 0.6], cut2=[-1.4, 0, 1.4])

    def test_strong_person_gets_hard_route(self):
        t, se, route, n = self.make_panel().administer(lambda b: 1)
        self.assertEqual(route, (2, 3))
        self.assertEqual(n, 9)
        self.assertGreater(t, 1.0)

    def test_weak_person_gets_easy_route(self):
        t, se, route, n = self.make_panel().administer(lambda b: 0)
        self.assertEqual(route, (0, 0))
        self.assertLess(t, -1.0)

    def test_invalid_cuts_rejected(self):
        with self.assertRaises(AssertionError):
            Panel([[0]], [[0], [0]], [[0], [0]], cut1=[0, 1], cut2=[0])


if __name__ == "__main__":
    unittest.main()

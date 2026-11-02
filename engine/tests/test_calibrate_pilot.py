import csv
import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import calibrate_pilot as cp  # noqa: E402
from rasch import p_correct  # noqa: E402


def make_csv(path, n_persons=400, seed=3):
    rng = random.Random(seed)
    bank = {"R-%d" % k: -2.5 + k * 0.5 for k in range(11)}
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["session_id", "part", "item_id", "answer", "correct", "time_ms", "answered_at"])
        for p in range(n_persons):
            th = rng.gauss(0, 1.2)
            for i, b in bank.items():
                if i == "R-5" and rng.random() < 0.5:
                    ok = int(th < 0)  # задание-«перевёртыш»: ведёт себя обратно ожидаемому
                else:
                    ok = int(rng.random() < p_correct(th, b))
                w.writerow(["s%d" % p, "reading", i, "0", ok, "", ""])
            for word, real in (("alpha", True), ("blorf", False)):
                said = rng.random() < (0.9 if real else 0.5)
                w.writerow(["s%d" % p, "vocab", "V:" + word, "yes" if said else "no", int(said == real), "", ""])
    return bank


class CalibratePilotTests(unittest.TestCase):
    def test_difficulty_order_and_flags(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "r.csv")
            make_csv(path)
            reading, vocab = cp.load(path)
            res = cp.analyse(reading, vocab)
        bs = [res["items"]["R-%d" % k]["b"] for k in range(11) if k != 5]
        self.assertEqual(bs, sorted(bs))
        self.assertIn("R-5", res["review"])  # бракованное задание найдено
        self.assertEqual(res["words"]["blorf"]["yes_rate"] > 0.35, True)
        self.assertEqual(res["n_sessions"], 400)

    def test_item_with_few_answers_is_flagged(self):
        reading = [("s1", "X", 1), ("s2", "X", 0)] + [("s%d" % k, "Y", k % 2) for k in range(40)]
        res = cp.analyse(reading, {}, min_n=30)
        self.assertIn("X", res["review"])


if __name__ == "__main__":
    unittest.main()

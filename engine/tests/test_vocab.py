import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import vocab_form as vf  # noqa: E402


def syllable_words(rng, n):
    cons, vow = "bcdfghklmnprstvz", "aeiou"
    out = set()
    while len(out) < n:
        out.add("".join(rng.choice(cons) + rng.choice(vow) for _ in range(rng.choice((2, 3)))) + rng.choice(["n", "r", "s", "t", ""]))
    return sorted(out)


class VocabTests(unittest.TestCase):
    def setUp(self):
        import random
        pool = syllable_words(random.Random(5), 600)
        self.by = {lv: set(pool[i * 100:(i + 1) * 100]) for i, lv in enumerate(vf.LEVELS)}
        self.allwords = set().union(*self.by.values())

    def test_degenerate_data_fails_loudly(self):
        tiny = {lv: {"abcdef%d" % k for k in range(0)} | {w for w in ["alpha", "beta", "gamma", "delta", "kappa", "sigma", "omega", "theta", "lambda", "zeta"][:10]} for lv in vf.LEVELS}
        with self.assertRaises((RuntimeError, ValueError)):
            vf.build_form(tiny, set().union(*tiny.values()), "s")
    def test_form_has_expected_counts(self):
        form = vf.build_form(self.by, self.allwords, "s")
        real = [i for i in form["items"] if i["real"]]
        pseudo = [i for i in form["items"] if not i["real"]]
        self.assertEqual(len(real), sum(vf.PER_LEVEL.values()))
        self.assertEqual(len(pseudo), vf.N_PSEUDO)
        self.assertTrue(all(i["review_required"] for i in pseudo))
        self.assertFalse({i["word"] for i in pseudo} & self.allwords)

    def test_extra_dictionary_excludes_words(self):
        base = vf.build_form(self.by, self.allwords, "s")
        banned = [i["word"] for i in base["items"] if not i["real"]]
        again = vf.build_form(self.by, self.allwords, "s", banned)
        self.assertFalse({i["word"] for i in again["items"] if not i["real"]} & set(banned))

    def test_same_seed_same_form_different_seed_differs(self):
        a = vf.build_form(self.by, self.allwords, "s1")
        b = vf.build_form(self.by, self.allwords, "s1")
        c = vf.build_form(self.by, self.allwords, "s2")
        self.assertEqual(a, b)
        self.assertNotEqual(a, c)

    def test_honest_knower_gets_high_level(self):
        form = vf.build_form(self.by, self.allwords, "s")
        ans = {i["word"]: i["real"] for i in form["items"]}
        r = vf.score(form, ans)
        self.assertTrue(r["valid"])
        self.assertEqual(r["provisional_level"], "C2")

    def test_yes_to_everything_is_invalid(self):
        form = vf.build_form(self.by, self.allwords, "s")
        r = vf.score(form, {i["word"]: True for i in form["items"]})
        self.assertFalse(r["valid"])
        self.assertEqual(r["levels"]["C2"]["corrected"], 0.0)

    def test_stops_at_first_failed_level(self):
        form = vf.build_form(self.by, self.allwords, "s")
        ans = {i["word"]: (i["real"] and i["level"] in ("A1", "A2", "B2", "C1", "C2")) for i in form["items"]}
        r = vf.score(form, ans)
        self.assertEqual(r["provisional_level"], "A2")


if __name__ == "__main__":
    unittest.main()

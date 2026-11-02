import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import textprofile as tp  # noqa: E402

LV = {"dog": "A1", "run": "A1", "park": "A1", "big": "A1", "reluctant": "C1", "ubiquitous": "C2", "walk": "A1"}


class TextProfileTests(unittest.TestCase):
    def test_inflections_resolve(self):
        self.assertEqual(tp.level_of("dogs", LV), "A1")
        self.assertEqual(tp.level_of("running", LV), "A1")
        self.assertEqual(tp.level_of("walked", LV), "A1")

    def test_simple_text_passes_a1(self):
        r = tp.check("The big dog runs in the park.", "A1", LV)
        self.assertTrue(r["ok"], r)

    def test_hard_words_fail_a1_and_pass_c2(self):
        text = "The reluctant dog found ubiquitous park signs."
        self.assertFalse(tp.check(text, "A1", LV)["ok"])
        self.assertTrue(tp.check(text, "C2", LV, max_unknown=0.5)["ok"])

    def test_proper_nouns_are_not_unknown(self):
        r = tp.check("The dog met Maria in Warsaw.", "A1", LV, max_unknown=0.0)
        self.assertEqual(r["unknown_words"], ["met"])  # 'met' не в тестовом списке, имена пропущены


if __name__ == "__main__":
    unittest.main()

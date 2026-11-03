#!/usr/bin/env python3
"""Пул слов для yes/no-теста: настоящие слова по уровням + псевдослова. Только stdlib.

  python3 build_vocab_pool.py --cefrj A.csv --octanove B.csv --dictionary words.txt --seed S --out pool.json

Псевдослова: правдоподобные строки из триграммной модели; отсев по большому словарю и по
простым производным (слово + окончание). Результат НУЖНО просмотреть человеком:
ни один словарь не полон (в публичном списке dwyl/english-words, например, нет слова "wring").
Источники и лицензии: CEFR-J (цитирование), Octanove C1/C2 (CC BY-SA 4.0): пул наследует CC BY-SA 4.0.
"""
import argparse
import json
import random
import sys

from vocab_form import TrigramModel, load_words, LEVELS

PER_LEVEL = {"A1": 40, "A2": 60, "B1": 60, "B2": 60, "C1": 60, "C2": 60}
N_PSEUDO = 160
SUFFIXES = ["s", "es", "ed", "d", "ing", "er", "ers", "est", "ly", "y", "ness", "ment", "al", "ion", "ions"]


def looks_derived(w, known):
    for s in SUFFIXES:
        if w.endswith(s) and w[: -len(s)] in known:
            return True
        if w.endswith(s) and len(w) - len(s) > 2 and (w[: -len(s)] + "e") in known:
            return True
    return False


ALPHA = "abcdefghijklmnopqrstuvwxyz"
VOWELS = set("aeiouy")


def one_edit_variants(w):
    """Все строки на расстоянии одной правки (удаление, замена, вставка, перестановка соседних)."""
    out = set()
    for i in range(len(w) + 1):
        if i < len(w):
            out.add(w[:i] + w[i + 1:])
            for c in ALPHA:
                out.add(w[:i] + c + w[i + 1:])
        for c in ALPHA:
            out.add(w[:i] + c + w[i:])
        if i < len(w) - 1:
            out.add(w[:i] + w[i + 1] + w[i] + w[i + 2:])
    out.discard(w)
    return out


def pronounceable(w):
    """Грубая проверка: не более 3 согласных и 2 гласных подряд, нет тройных повторов, есть гласная."""
    cons = vow = 0
    for i, ch in enumerate(w):
        if ch in VOWELS:
            vow += 1
            cons = 0
        else:
            cons += 1
            vow = 0
        if cons > 3 or vow > 2:
            return False
        if i >= 2 and w[i] == w[i - 1] == w[i - 2]:
            return False
    return any(ch in VOWELS for ch in w) and w[-1] not in "jqvz"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--cefrj", required=True)
    ap.add_argument("--octanove", required=True)
    ap.add_argument("--dictionary", required=True)
    ap.add_argument("--seed", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    rng = random.Random(a.seed)
    by_level, allwords = load_words(a.cefrj, a.octanove)
    big = {w.strip().lower() for w in open(a.dictionary, encoding="utf-8")}
    known = big | allwords
    real = {}
    for lv in LEVELS:
        pool = sorted(by_level[lv])
        real[lv] = sorted(rng.sample(pool, min(PER_LEVEL[lv], len(pool))))
    model = TrigramModel(sorted(set().union(*by_level.values())))
    pseudo = set()
    for _ in range(200000):
        if len(pseudo) >= N_PSEUDO:
            break
        w = model.make(rng, lo=5, hi=9)
        if (w and w not in known and pronounceable(w) and not looks_derived(w, known)
                and not (one_edit_variants(w) & known)):
            pseudo.add(w)
    out = {
        "_license": "CC BY-SA 4.0 (содержит данные Octanove Vocabulary Profile C1/C2, CC BY-SA 4.0) и CEFR-J Vocabulary Profile: "
                    "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.",
        "real": real,
        "pseudo": sorted(pseudo),
    }
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print({lv: len(v) for lv, v in real.items()}, "pseudo:", len(pseudo))
    return 0


if __name__ == "__main__":
    sys.exit(main())

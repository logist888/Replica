#!/usr/bin/env python3
"""Независимая проверка банка заданий чтения. Только stdlib.

  python3 qa_reading.py content/reading --cefrj A.csv --octanove B.csv

Проверяет: структуру, уникальность id, 4 варианта, индекс ответа, распределение позиций ответа,
долю заданий, где верный вариант самый длинный, повторы вариантов, запретные слова (названия
экзаменов), длину текста по уровням, лексический профиль (textprofile). Код возврата 1 при ошибках.
"""
import argparse
import glob
import json
import os
import re
import sys
from collections import Counter

import textprofile as tp

LEN = {"A1": (35, 75), "A2": (55, 110), "B1": (95, 175), "B2": (140, 240), "C1": (190, 300), "C2": (220, 340)}
BANNED = re.compile(r"\b(ielts|toefl|toeic|cambridge|duolingo|efset|ef set|pearson|oxford)\b", re.I)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--cefrj", required=True)
    ap.add_argument("--octanove", required=True)
    a = ap.parse_args(argv)
    lv = tp.load(a.cefrj, a.octanove)
    errors, warns = [], []
    passages = []
    for f in sorted(glob.glob(os.path.join(a.dir, "*.json"))):
        passages += json.load(open(f, encoding="utf-8"))
    ids = Counter()
    pos = Counter()
    longest = 0
    nq = 0
    texts = Counter()
    per_level = Counter()
    prof = {}
    for p in passages:
        per_level[p["level"]] += 1
        ids[p["id"]] += 1
        texts[p["text"].strip().lower()] += 1
        n_words = len(re.findall(r"[A-Za-z']+", p["text"]))
        lo, hi = LEN[p["level"]]
        if not lo <= n_words <= hi:
            warns.append("%s: %d слов вне диапазона %s" % (p["id"], n_words, LEN[p["level"]]))
        if BANNED.search(p["text"]) or any(BANNED.search(q["stem"] + " ".join(q["options"])) for q in p["questions"]):
            errors.append("%s: упоминание бренда экзамена" % p["id"])
        r = tp.check(p["text"], p["level"], lv, max_above=0.06 if p["level"] in ("A1", "A2", "B1", "B2") else 1.0,
                     max_unknown=0.12)
        prof.setdefault(p["level"], []).append(r)
        if not r["ok"]:
            warns.append("%s: профиль лексики вне нормы (above=%.2f unknown=%.2f) %s" % (
                p["id"], r["above_share"], r["unknown_share"], [w for w, _ in r["above_words"]][:6]))
        if len(p["questions"]) != 3:
            errors.append("%s: вопросов не 3" % p["id"])
        for q in p["questions"]:
            nq += 1
            ids[q["id"]] += 1
            o = q["options"]
            if len(o) != 4 or len(set(x.strip().lower() for x in o)) != 4:
                errors.append("%s: нужно 4 разных варианта" % q["id"])
                continue
            if not isinstance(q["answer"], int) or not 0 <= q["answer"] <= 3:
                errors.append("%s: плохой индекс ответа" % q["id"])
                continue
            pos[q["answer"]] += 1
            lens = [len(x) for x in o]
            if lens[q["answer"]] == max(lens) and lens.count(max(lens)) == 1:
                longest += 1
            if not q["stem"].strip().endswith(("?", ".", ":", "...")) and "_" not in q["stem"]:
                warns.append("%s: формулировка без знака в конце" % q["id"])
    for k, c in ids.items():
        if c > 1:
            errors.append("повтор id: %s" % k)
    for t, c in texts.items():
        if c > 1:
            errors.append("повтор текста: %s…" % t[:40])
    print("passages:", len(passages), dict(sorted(per_level.items())), "questions:", nq)
    print("answer positions:", dict(sorted(pos.items())))
    print("correct = longest option: %d of %d (%.0f%%)" % (longest, nq, 100 * longest / max(nq, 1)))
    for L in tp.ORDER:
        if L in prof:
            above = sum(x["above_share"] for x in prof[L]) / len(prof[L])
            hi = sum(x["counts"]["C1"] + x["counts"]["C2"] for x in prof[L]) / max(sum(x["content_words"] for x in prof[L]), 1)
            print("  %s: avg above-level %.3f, share C1/C2 words %.3f" % (L, above, hi))
    for e in errors:
        print("ERROR:", e)
    for w in warns:
        print("warn:", w)
    print("errors: %d, warnings: %d" % (len(errors), len(warns)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

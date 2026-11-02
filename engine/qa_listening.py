#!/usr/bin/env python3
"""Независимая проверка сценариев аудирования. Только stdlib.

  python3 qa_listening.py content/listening --cefrj A.csv --octanove B.csv
Проверяет структуру, id, 4 варианта, позиции ответов, длину текста по уровням, согласованность target_seconds,
запретные слова, профиль лексики (после раскрытия сокращений), совпадение меток говорящих. Код 1 при ошибках.
"""
import argparse
import glob
import json
import os
import re
import sys
from collections import Counter

import textprofile as tp

LEN = {"A1": (38, 80), "A2": (60, 125), "B1": (100, 190), "B2": (160, 265), "C1": (215, 335), "C2": (265, 400)}
BANNED = re.compile(r"\b(ielts|toefl|toeic|cambridge|duolingo|efset|ef set|pearson|oxford)\b", re.I)
CONTR = [("n't", " not"), ("'m", " am"), ("'re", " are"), ("'ve", " have"), ("'ll", " will"), ("'d", " would"), ("'s", "")]


def clean(t):
    t = re.sub(r"^[A-Z][A-Za-z]*:\s*", "", t, flags=re.M)
    t = t.replace("é", "e").replace("-", " ")
    for a, b in CONTR:
        t = t.replace(a, b)
    return t


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--cefrj", required=True)
    ap.add_argument("--octanove", required=True)
    a = ap.parse_args(argv)
    lv = tp.load(a.cefrj, a.octanove)
    errors, warns, ids, pos = [], [], Counter(), Counter()
    items = []
    for f in sorted(glob.glob(os.path.join(a.dir, "*.json"))):
        items += json.load(open(f, encoding="utf-8"))
    longest = nq = 0
    per = Counter()
    for s in items:
        per[s["level"]] += 1
        ids[s["id"]] += 1
        words = len(re.findall(r"[A-Za-z']+", clean(s["transcript"]).replace("'", "")))
        lo, hi = LEN[s["level"]]
        if not lo <= words <= hi:
            warns.append("%s: %d слов вне диапазона %s" % (s["id"], words, LEN[s["level"]]))
        exp = words / 2.4
        if abs(s.get("target_seconds", 0) - exp) > 0.2 * exp + 3:
            warns.append("%s: target_seconds %s при ~%d" % (s["id"], s.get("target_seconds"), exp))
        if BANNED.search(s["transcript"]) or any(BANNED.search(q["stem"] + " ".join(q["options"])) for q in s["questions"]):
            errors.append("%s: бренд экзамена" % s["id"])
        labels = set(re.findall(r"^([A-Z][A-Za-z]*):", s["transcript"], flags=re.M))
        spk = {x["label"] for x in s.get("speakers", [])}
        if labels and labels != spk:
            errors.append("%s: метки в тексте %s не совпадают с speakers %s" % (s["id"], sorted(labels), sorted(spk)))
        if len(s["questions"]) != 3:
            errors.append("%s: вопросов не 3" % s["id"])
        r = tp.check(clean(s["transcript"]), s["level"], lv, max_above=0.06 if s["level"] in ("A1", "A2", "B1", "B2") else 1.0, max_unknown=0.16)
        if not r["ok"]:
            warns.append("%s: профиль лексики above=%.2f unknown=%.2f %s" % (s["id"], r["above_share"], r["unknown_share"], [w for w, _ in r["above_words"]][:5]))
        for q in s["questions"]:
            nq += 1
            ids[q["id"]] += 1
            o = q["options"]
            if len(o) != 4 or len({x.strip().lower() for x in o}) != 4 or not (isinstance(q["answer"], int) and 0 <= q["answer"] <= 3):
                errors.append("%s: плохие варианты/ответ" % q["id"])
                continue
            pos[q["answer"]] += 1
            ln = [len(x) for x in o]
            if ln[q["answer"]] == max(ln) and ln.count(max(ln)) == 1:
                longest += 1
    for k, c in ids.items():
        if c > 1:
            errors.append("повтор id %s" % k)
    print("scripts:", len(items), dict(sorted(per.items())), "questions:", nq)
    print("answer positions:", dict(sorted(pos.items())))
    print("correct = longest: %d of %d" % (longest, nq))
    for e in errors:
        print("ERROR:", e)
    for w in warns:
        print("warn:", w)
    print("errors: %d, warnings: %d" % (len(errors), len(warns)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

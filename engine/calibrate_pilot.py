#!/usr/bin/env python3
"""Калибровка по выгрузке пилота. Только stdlib.

  python3 calibrate_pilot.py responses.csv --out calibration.json [--min-n 30]

Вход: CSV из /api/admin/export?kind=responses (session_id, part, item_id, answer, correct, ...).
Выход: JSON со сложностью заданий чтения (b, логиты, среднее b = 0), статистикой заданий,
списком заданий на проверку и статистикой слов (в т.ч. подозрительных псевдослов).

Критерии отбраковки (настраиваемые допущения, не нормы):
  n < min-n; доля верных > 0.97 или < 0.08 (нет информации); точечно-бисериальная корреляция
  с суммой по остальным заданиям < 0.10 (задание не различает сильных и слабых).
Псевдослово с долей «знаю» >= 0.35 — подозрение, что оно похоже на настоящее слово: заменить.
"""
import argparse
import csv
import json
import math
import sys
from collections import defaultdict

from rasch import calibrate_jml


def load(path):
    reading, vocab = [], defaultdict(list)
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["part"] == "reading":
                reading.append((r["session_id"], r["item_id"], int(r["correct"])))
            elif r["part"] == "vocab":
                vocab[r["item_id"]].append((r["session_id"], r["answer"] == "yes", int(r["correct"])))
    return reading, vocab


def point_biserial(item, rows_by_person, person_total, person_n):
    xs, ys = [], []
    for p, x in rows_by_person.get(item, []):
        n = person_n[p] - 1
        if n < 5:
            continue
        xs.append(x)
        ys.append((person_total[p] - x) / n)
    if len(xs) < 10:
        return None
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs) / len(xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys) / len(ys))
    if sx == 0 or sy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (len(xs) * sx * sy)


def analyse(reading, vocab, min_n=30):
    person_total, person_n = defaultdict(int), defaultdict(int)
    by_item = defaultdict(list)
    for p, i, x in reading:
        person_total[p] += x
        person_n[p] += 1
        by_item[i].append((p, x))
    rows_by_person = by_item  # по заданию: список (человек, ответ)
    b, theta, se = calibrate_jml(reading)
    items = {}
    review = []
    for i, rows in sorted(by_item.items()):
        n = len(rows)
        pv = sum(x for _, x in rows) / n
        pb = point_biserial(i, rows_by_person, person_total, person_n)
        reasons = []
        if n < min_n:
            reasons.append("мало ответов (n=%d)" % n)
        if pv > 0.97 or pv < 0.08:
            reasons.append("доля верных %.2f" % pv)
        if pb is not None and pb < 0.10:
            reasons.append("низкая дискриминация (r=%.2f)" % pb)
        items[i] = {"n": n, "p": round(pv, 3), "r_pb": None if pb is None else round(pb, 3),
                    "b": None if i not in b else round(b[i], 3), "se_b": None if i not in se else round(se[i], 3),
                    "review": reasons}
        if reasons:
            review.append(i)
    words = {}
    suspicious = []
    for item, rows in sorted(vocab.items()):
        word = item[2:]
        yes = sum(1 for _, y, _ in rows if y) / len(rows)
        words[word] = {"n": len(rows), "yes_rate": round(yes, 3)}
    return {"items": items, "review": review, "n_sessions": len({p for p, _, _ in reading}),
            "n_items_calibrated": len(b), "words": words, "suspicious_pseudo_candidates": suspicious}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("responses")
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-n", type=int, default=30)
    ap.add_argument("--pseudo", help="JSON-файл пула слов (content/vocab/pool.json) для отметки псевдослов")
    a = ap.parse_args(argv)
    reading, vocab = load(a.responses)
    res = analyse(reading, vocab, a.min_n)
    if a.pseudo:
        pseudo = set(json.load(open(a.pseudo, encoding="utf-8"))["pseudo"])
        res["suspicious_pseudo_candidates"] = sorted(w for w, s in res["words"].items() if w in pseudo and s["n"] >= 15 and s["yes_rate"] >= 0.35)
    json.dump(res, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("sessions:", res["n_sessions"], "items calibrated:", res["n_items_calibrated"], "to review:", len(res["review"]),
          "suspicious pseudo:", len(res["suspicious_pseudo_candidates"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

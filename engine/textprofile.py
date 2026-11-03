#!/usr/bin/env python3
"""Профиль лексики текста по уровням CEFR-J / Octanove. Только stdlib.

Проверка, что текст задания не сложнее заявленного уровня:
  python3 textprofile.py check --cefrj A.csv --octanove B.csv --level B1 --text "..."
  python3 textprofile.py check ... --level B1 --file passage.txt

Правило (допущение, настраивается): для уровня L доля слов выше L не более 4%,
доля неизвестных слов (нет в списках, не имя собственное) не более 10%.
Не заменяет проверку человеком: список не содержит всех форм слов.
"""
import argparse
import csv
import json
import re
import sys

ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
TOKEN = re.compile(r"[A-Za-z][A-Za-z'-]*")
# слова, которые есть в любом тексте и в списках могут отсутствовать как отдельные заглавные слова
FUNCTION = set("""a an the and or but if so than that this these those there here it its i you he she we they me him her us them my your his our their
am is are was were be been being do does did done have has had having will would shall should can could may might must not no yes to of in on at by for with from
about into over after before between under again then once up down out off s t d ll re ve m what which who whom whose when where why how all any both each few more
most other some such only own same too very just also""".split())


def load(cefrj, octanove):
    lv = {}
    for path in (cefrj, octanove):
        with open(path, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                for h in r["headword"].lower().replace(" ", "").split("/"):
                    h = h.strip()
                    if h:
                        cur = lv.get(h)
                        if cur is None or ORDER.index(r["CEFR"]) < ORDER.index(cur):
                            lv[h] = r["CEFR"]
    return lv


def candidates(w):
    w = w.lower().strip("'-")
    yield w
    for suf, rep in (("ies", "y"), ("es", ""), ("s", ""), ("ied", "y"), ("ed", ""), ("d", ""),
                     ("ing", ""), ("ing", "e"), ("ly", ""), ("er", ""), ("est", ""), ("er", "e")):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            c = w[: -len(suf)] + rep
            yield c
            if len(c) >= 3 and c[-1] == c[-2]:  # running -> runn -> run
                yield c[:-1]
    if len(w) > 4 and w[-1] == w[-2]:
        yield w[:-1]


def level_of(word, lv):
    for c in candidates(word):
        if c in lv:
            return lv[c]
    return None


def profile(text, lv):
    toks = TOKEN.findall(text)
    counts = {k: 0 for k in ORDER}
    unknown, total = [], 0
    for i, t in enumerate(toks):
        low = t.lower().strip("'-")
        if low in FUNCTION or len(low) <= 1:
            continue
        total += 1
        L = level_of(low, lv)
        if L:
            counts[L] += 1
        elif t[0].isupper() and i > 0:
            total -= 1  # имя собственное
        else:
            unknown.append(low)
    return counts, unknown, total


def check(text, level, lv, max_above=0.04, max_unknown=0.10):
    counts, unknown, total = profile(text, lv)
    above = sum(counts[k] for k in ORDER if ORDER.index(k) > ORDER.index(level))
    above_words = []
    for t in TOKEN.findall(text):
        L = level_of(t.lower(), lv)
        if L and ORDER.index(L) > ORDER.index(level):
            above_words.append((t.lower(), L))
    total = max(total, 1)
    ok = above / total <= max_above and len(unknown) / total <= max_unknown
    return {
        "level": level, "content_words": total, "counts": counts,
        "above_share": round(above / total, 3), "unknown_share": round(len(unknown) / total, 3),
        "above_words": sorted(set(above_words)), "unknown_words": sorted(set(unknown)), "ok": ok,
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("--cefrj", required=True)
    c.add_argument("--octanove", required=True)
    c.add_argument("--level", required=True, choices=ORDER)
    g = c.add_mutually_exclusive_group(required=True)
    g.add_argument("--text")
    g.add_argument("--file")
    a = ap.parse_args(argv)
    text = a.text if a.text is not None else open(a.file, encoding="utf-8").read()
    res = check(text, a.level, load(a.cefrj, a.octanove))
    print(json.dumps(res, ensure_ascii=False, indent=1))
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

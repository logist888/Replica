#!/usr/bin/env python3
"""Сборка формы yes/no-теста словаря и подсчёт балла. Только stdlib.

Данные (скачать отдельно, в репозиторий не кладём):
  CEFR-J Vocabulary Profile 1.5 и Octanove Vocabulary Profile C1/C2, оба в
  https://github.com/openlanguageprofiles/olp-en-cefrj

Лицензии (проверено по README репозитория и странице загрузки cefr-j.org):
  CEFR-J: коммерческое и исследовательское использование бесплатно, с указанием источника;
          правообладатель Tono Laboratory, TUFS. Цитата:
          "The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies."
  Octanove C1/C2: CC BY-SA 4.0 (производные списки слов распространять под той же лицензией).

Использование:
  python3 vocab_form.py build --cefrj cefrj.csv --octanove oct.csv --seed SECRET --out form.json
  python3 vocab_form.py score --form form.json --answers answers.json
Seed хранить в секрете: форма должна быть непредсказуема, иначе её можно заучить.
Псевдослова нужно просмотреть человеком (флаг review_required): генератор не гарантирует,
что строка не является редким настоящим словом.
"""
import argparse
import csv
import json
import random
import re
import sys
from collections import defaultdict

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
PER_LEVEL = {"A1": 4, "A2": 8, "B1": 8, "B2": 8, "C1": 8, "C2": 8}
N_PSEUDO = 16
WORD = re.compile(r"^[a-z]{4,11}$")


def load_words(cefrj_path, octanove_path):
    by_level = defaultdict(set)
    allwords = set()
    for path in (cefrj_path, octanove_path):
        with open(path, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                w = r["headword"].strip().lower()
                allwords.add(w)
                if WORD.match(w):
                    by_level[r["CEFR"].strip()].add(w)
    return by_level, allwords


class TrigramModel:
    """Модель триграмм букв для правдоподобных несуществующих слов."""

    def __init__(self, words):
        self.next = defaultdict(list)
        for w in words:
            s = "^^" + w + "$"
            for i in range(len(s) - 2):
                self.next[s[i:i + 2]].append(s[i + 2])

    def make(self, rng, lo=5, hi=9):
        for _ in range(200):
            s = "^^"
            while len(s) < hi + 3:
                c = rng.choice(self.next[s[-2:]])
                if c == "$":
                    break
                s += c
            w = s[2:]
            if lo <= len(w) <= hi and w.isalpha():
                return w
        return None


def build_form(by_level, allwords, seed, extra_known=()):
    """extra_known: дополнительный словарь (одно слово на строку) для отсева настоящих слов среди псевдослов."""
    rng = random.Random(seed)
    allwords = set(allwords) | {w.strip().lower() for w in extra_known}
    items = []
    for lv in LEVELS:
        pool = sorted(by_level[lv])
        if len(pool) < PER_LEVEL[lv]:
            raise ValueError("мало слов уровня " + lv)
        for w in rng.sample(pool, PER_LEVEL[lv]):
            items.append({"word": w, "real": True, "level": lv})
    model = TrigramModel(sorted(set().union(*by_level.values())))
    seen = set()
    for _ in range(50000):  # предохранитель: на вырожденных данных не зацикливаться
        if len(seen) >= N_PSEUDO:
            break
        w = model.make(rng)
        if w and w not in allwords and w not in seen:
            seen.add(w)
            items.append({"word": w, "real": False, "level": None, "review_required": True})
    if len(seen) < N_PSEUDO:
        raise RuntimeError("не удалось построить %d псевдослов; нужен более разнообразный список слов" % N_PSEUDO)
    rng.shuffle(items)
    return {"version": 1, "items": items}


def score(form, answers):
    """answers: {word: true|false} (true = «знаю»). Возвращает оценку по уровням и итог.

    Поправка на угадывание: (h - f) / (1 - f), h — доля «знаю» среди настоящих слов,
    f — доля «знаю» среди псевдослов. Предварительная эвристика до калибровки по пилоту.
    """
    pseudo = [i for i in form["items"] if not i["real"]]
    fa = sum(1 for i in pseudo if answers.get(i["word"])) / max(len(pseudo), 1)
    out = {"false_alarm_rate": fa, "levels": {}}
    for lv in LEVELS:
        its = [i for i in form["items"] if i["real"] and i["level"] == lv]
        h = sum(1 for i in its if answers.get(i["word"])) / max(len(its), 1)
        corrected = max(0.0, (h - fa) / (1 - fa)) if fa < 1 else 0.0
        out["levels"][lv] = {"hit_rate": h, "corrected": corrected}
    out["valid"] = fa <= 0.40  # слишком много «знаю» на псевдослова — ответам не доверяем
    # уровень: самый высокий, где скорректированная доля >= 0.6, при условии что ниже тоже >= 0.6
    est = None
    for lv in LEVELS:
        if out["levels"][lv]["corrected"] >= 0.6:
            est = lv
        else:
            break
    out["provisional_level"] = est
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--cefrj", required=True)
    b.add_argument("--octanove", required=True)
    b.add_argument("--seed", required=True)
    b.add_argument("--out", required=True)
    b.add_argument("--dictionary", help="файл со словарём, по слову в строке (отсев настоящих слов)")
    s = sub.add_parser("score")
    s.add_argument("--form", required=True)
    s.add_argument("--answers", required=True)
    a = ap.parse_args(argv)
    if a.cmd == "build":
        by_level, allwords = load_words(a.cefrj, a.octanove)
        extra = open(a.dictionary, encoding="utf-8").read().split() if a.dictionary else ()
        form = build_form(by_level, allwords, a.seed, extra)
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(form, f, ensure_ascii=False, indent=1)
        print("items:", len(form["items"]), "pseudo:", sum(1 for i in form["items"] if not i["real"]))
    else:
        form = json.load(open(a.form, encoding="utf-8"))
        answers = json.load(open(a.answers, encoding="utf-8"))
        print(json.dumps(score(form, answers), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())

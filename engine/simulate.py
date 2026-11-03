#!/usr/bin/env python3
"""Симуляция: насколько точна схема при заданных размерах пилота и модулей.

    python3 simulate.py            # печатает таблицы
Результат симуляции — оценка при допущениях модели Раша, а не измерение реального теста.
"""
import math
import random
import statistics as st

from rasch import calibrate_jml, p_correct
from mst import Panel

SEED = 20261102


def make_bank(n, rng, lo=-3.0, hi=3.0):
    return sorted(rng.uniform(lo, hi) for _ in range(n))


def calibration_recovery(rng, n_items=150, per_person=40, sizes=(100, 200, 300, 500)):
    bank = [rng.uniform(-3, 3) for _ in range(n_items)]
    out = []
    for n in sizes:
        resp = []
        for p in range(n):
            th = rng.gauss(0, 1.3)
            for i in rng.sample(range(n_items), per_person):
                resp.append((p, i, 1 if rng.random() < p_correct(th, bank[i]) else 0))
        b, _, _ = calibrate_jml(resp)
        # выравнивание шкалы: сдвиг по среднему общих заданий
        common = [i for i in b]
        shift = st.mean(bank[i] - b[i] for i in common)
        err = [(b[i] + shift) - bank[i] for i in common]
        rmse = math.sqrt(sum(e * e for e in err) / len(err))
        out.append((n, len(common), rmse, st.mean(abs(e) for e in err)))
    return out


def build_panel(bank, m, est_noise, rng):
    """Модули из заданий банка, ближайших к целевой сложности; сложности известны с шумом est_noise."""
    used = set()

    def module(target):
        cand = sorted((i for i in range(len(bank)) if i not in used), key=lambda i: abs(bank[i] - target))[:m]
        used.update(cand)
        return cand

    s1 = module(0.0)
    s2 = [module(t) for t in (-1.2, 0.0, 1.2)]
    s3 = [module(t) for t in (-2.2, -0.8, 0.8, 2.2)]

    def est(idx):
        return [bank[i] + rng.gauss(0, est_noise) for i in idx]  # то, что знает система

    panel = Panel([est(s1)], [est(x) for x in s2], [est(x) for x in s3],
                  cut1=[-0.6, 0.6], cut2=[-1.4, 0.0, 1.4])
    truth = {"s1": s1, "s2": s2, "s3": s3}
    return panel, truth


def run_mst(m, est_noise, rng, bank, n_persons=3000):
    panel, truth = build_panel(bank, m, est_noise, rng)
    # соответствие est->true по порядку обхода: respond получает оценённую b, но ответ определяется истинной
    errs, ses, n_items = [], [], []
    # привяжем истинные b к оценённым: ответ зависит от истинной сложности
    stages = [[panel.stage1], panel.stage2, panel.stage3]
    tstages = [[truth["s1"]], truth["s2"], truth["s3"]]
    lookup = {}
    for sg, tg in zip(stages, tstages):
        for mod_est, mod_true in zip(sg, tg):
            for be, ti in zip(mod_est, mod_true):
                lookup[be] = bank[ti]
    for _ in range(n_persons):
        th = rng.gauss(0, 1.3)
        t, se, route, n = panel.administer(lambda be: 1 if rng.random() < p_correct(th, lookup[be]) else 0)
        errs.append(t - th)
        ses.append(se)
        n_items.append(n)
    rmse = math.sqrt(sum(e * e for e in errs) / len(errs))
    return rmse, st.mean(ses), st.mean(n_items)


def run_fixed(n_items, est_noise, rng, bank, n_persons=3000):
    from rasch import eap
    idx = rng.sample(range(len(bank)), n_items)  # фиксированная форма по всему диапазону сложности
    est = {i: bank[i] + rng.gauss(0, est_noise) for i in idx}
    errs, ses = [], []
    for _ in range(n_persons):
        th = rng.gauss(0, 1.3)
        ans = [(est[i], 1 if rng.random() < p_correct(th, bank[i]) else 0) for i in idx]
        t, se = eap(ans)
        errs.append(t - th)
        ses.append(se)
    return math.sqrt(sum(e * e for e in errs) / len(errs)), st.mean(ses)


def main():
    rng = random.Random(SEED)
    print("1. Восстановление сложности заданий по пилоту (150 заданий, 40 на человека)")
    print("   N человек | заданий | RMSE b, логитов | средняя |ошибка|")
    for n, k, rmse, mae in calibration_recovery(rng):
        print(f"   {n:9d} | {k:7d} | {rmse:15.2f} | {mae:.2f}")

    bank = make_bank(220, rng)
    print("\n2. Схема 3 стадий: точность оценки способности (3000 симулированных людей, theta ~ N(0, 1.3))")
    print("   RMSE — корень средней квадратичной ошибки, SE — средняя заявленная стандартная ошибка")
    print("   заданий/модуль | всего | шум калибровки | RMSE MST | SE MST | RMSE фикс. форма той же длины")
    for m in (6, 8, 10):
        for noise in (0.0, 0.3, 0.5):
            r_m, se_m, n = run_mst(m, noise, rng, bank)
            r_f, se_f = run_fixed(int(round(n)), noise, rng, bank)
            print(f"   {m:14d} | {n:5.0f} | {noise:14.1f} | {r_m:8.2f} | {se_m:6.2f} | {r_f:.2f}")


if __name__ == "__main__":
    main()

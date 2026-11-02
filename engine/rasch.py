"""Модель Раша на стандартной библиотеке: калибровка по пилоту и оценка способности.

Только stdlib. Никаких GPL-зависимостей (mirt лицензирован GPL>=3, поэтому не используем).
theta, b в логитах. Вероятность верного ответа: 1 / (1 + exp(-(theta - b))).
"""
import math


def p_correct(theta, b):
    return 1.0 / (1.0 + math.exp(-(theta - b)))


def calibrate_jml(responses, n_iter=60, tol=1e-4, adjust=0.3):
    """Совместная максимизация правдоподобия (JML) с неполным дизайном.

    responses: список (person_id, item_id, 0|1).
    Возвращает (b, theta, se_b): словари. Центрирование: среднее b = 0.
    Люди и задания с нулевой или полной суммой исключаются (оценка бесконечна).
    Смещение JML на малых выборках (~ n/(n-1)) исправляется поправкой для заданий.
    """
    by_p, by_i = {}, {}
    for p, i, x in responses:
        by_p.setdefault(p, []).append((i, x))
        by_i.setdefault(i, []).append((p, x))

    # убрать крайние суммы итеративно
    changed = True
    while changed:
        changed = False
        for p in list(by_p):
            xs = [x for _, x in by_p[p]]
            if sum(xs) == 0 or sum(xs) == len(xs):
                for i, x in by_p.pop(p):
                    by_i[i] = [(q, y) for q, y in by_i[i] if q != p]
                changed = True
        for i in list(by_i):
            xs = [x for _, x in by_i[i]]
            if not xs or sum(xs) == 0 or sum(xs) == len(xs):
                for p, x in by_i.pop(i, []):
                    if p in by_p:
                        by_p[p] = [(j, y) for j, y in by_p[p] if j != i]
                changed = True

    theta = {p: 0.0 for p in by_p}
    b = {i: 0.0 for i in by_i}
    for _ in range(n_iter):
        delta = 0.0
        for p, rows in by_p.items():
            s = sum(x for _, x in rows)
            pr = [p_correct(theta[p], b[i]) for i, _ in rows]
            info = sum(q * (1 - q) for q in pr)
            step = (s - sum(pr)) / max(info, 1e-9)
            step = max(-1.0, min(1.0, step))
            theta[p] += step
            delta = max(delta, abs(step))
        for i, rows in by_i.items():
            s = sum(x for _, x in rows)
            pr = [p_correct(theta[q], b[i]) for q, _ in rows]
            info = sum(q * (1 - q) for q in pr)
            step = (sum(pr) - s) / max(info, 1e-9)
            step = max(-1.0, min(1.0, step))
            b[i] += step
            delta = max(delta, abs(step))
        mean_b = sum(b.values()) / len(b)
        for i in b:
            b[i] -= mean_b
        for p in theta:
            theta[p] -= mean_b
        if delta < tol:
            break

    # поправка на смещение JML для заданий
    k = sum(len(r) for r in by_p.values()) / max(len(by_p), 1)  # среднее число заданий на человека
    corr = (k - 1) / k if k > 1 else 1.0
    b = {i: v * corr for i, v in b.items()}
    se_b = {}
    for i, rows in by_i.items():
        info = sum(p_correct(theta[q], b[i]) * (1 - p_correct(theta[q], b[i])) for q, _ in rows)
        se_b[i] = 1.0 / math.sqrt(max(info, 1e-9))
    return b, theta, se_b


_GRID = [x / 10.0 for x in range(-60, 61)]


def eap(answers, prior_sd=2.0):
    """Ожидаемая апостериорная оценка theta. answers: список (b, 0|1).

    Возвращает (theta, se). Для пустого списка: (0, prior_sd).
    """
    if not answers:
        return 0.0, prior_sd
    num = den = 0.0
    post = []
    for t in _GRID:
        ll = -0.5 * (t / prior_sd) ** 2
        for bi, x in answers:
            q = p_correct(t, bi)
            ll += math.log(q if x else 1 - q)
        w = math.exp(ll)
        post.append(w)
        den += w
    mean = sum(w * t for w, t in zip(post, _GRID)) / den
    var = sum(w * (t - mean) ** 2 for w, t in zip(post, _GRID)) / den
    return mean, math.sqrt(var)

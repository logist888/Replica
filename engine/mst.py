"""Трёхстадийное адаптивное тестирование (ca-MST), собственная реализация.

Панель: стадия 1 — один модуль; стадия 2 — несколько модулей; стадия 3 — несколько модулей.
Маршрутизация по текущей оценке theta (EAP), а не по таблице баллов: так не нужны
пороги по сумме при неравном числе заданий в модулях.
"""
from rasch import eap


class Panel:
    def __init__(self, stage1, stage2, stage3, cut1, cut2):
        """stageN: список модулей, модуль = список b заданий (откалиброванные сложности).

        cut1: пороги theta для выбора модуля стадии 2 (длина = len(stage2) - 1).
        cut2: пороги theta для выбора модуля стадии 3 (длина = len(stage3) - 1).
        """
        assert len(stage1) == 1
        assert len(cut1) == len(stage2) - 1 and len(cut2) == len(stage3) - 1
        self.stage1, self.stage2, self.stage3 = stage1[0], stage2, stage3
        self.cut1, self.cut2 = cut1, cut2

    @staticmethod
    def _pick(theta, cuts):
        for k, c in enumerate(cuts):
            if theta < c:
                return k
        return len(cuts)

    def administer(self, respond):
        """respond(b) -> 0|1. Возвращает (theta, se, route, число заданий)."""
        answers = [(b, respond(b)) for b in self.stage1]
        t, _ = eap(answers)
        k1 = self._pick(t, self.cut1)
        answers += [(b, respond(b)) for b in self.stage2[k1]]
        t, _ = eap(answers)
        k2 = self._pick(t, self.cut2)
        answers += [(b, respond(b)) for b in self.stage3[k2]]
        t, se = eap(answers)
        return t, se, (k1, k2), len(answers)

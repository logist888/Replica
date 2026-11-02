import { test } from "node:test";
import assert from "node:assert/strict";
import { eap, pCorrect, thetaToLevel, readingEstimate, vocabScore, PRIOR_B, LEVELS } from "../src/lib/scoring.ts";

// Эталонные значения посчитаны engine/rasch.py (eap) с теми же входами.
test("eap совпадает с Python-версией (engine/rasch.py)", () => {
  const cases: Array<[Array<[number, 0 | 1]>, number, number]> = [
    [[[-1, 1], [0, 1], [1, 0]], 0.6401491792085753, 1.146023354735068],
    [[[-2.5, 1], [-1.5, 1], [-0.5, 1], [0.5, 0], [1.5, 0], [2.5, 0]], 0, 0.9454229850869995],
    [[[0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0], [1.5, 0], [1.5, 0]], -2.104519346753223, 1.255274695721924],
  ];
  for (const [answers, theta, se] of cases) {
    const r = eap(answers);
    assert.ok(Math.abs(r.theta - theta) < 1e-9, `theta ${r.theta} vs ${theta}`);
    assert.ok(Math.abs(r.se - se) < 1e-9, `se ${r.se} vs ${se}`);
  }
  assert.deepEqual(eap([]), { theta: 0, se: 2 });
});

test("pCorrect равна 0.5 при равенстве", () => {
  assert.equal(pCorrect(1, 1), 0.5);
});

test("граничные уровни на шкале theta", () => {
  assert.equal(thetaToLevel(-3), "A1");
  assert.equal(thetaToLevel(-1.5), "A2");
  assert.equal(thetaToLevel(-0.2), "B1");
  assert.equal(thetaToLevel(0.4), "B2");
  assert.equal(thetaToLevel(1.5), "C1");
  assert.equal(thetaToLevel(3), "C2");
});

test("человек, верно отвечающий до B1 и ошибающийся выше, получает B1-B2", () => {
  const items = LEVELS.flatMap((lv) => [1, 2, 3].map(() => ({ level: lv, correct: PRIOR_B[lv] < 0 })));
  const r = readingEstimate(items);
  assert.ok(["B1", "B2"].includes(r.level), r.level);
  assert.ok(LEVELS.indexOf(r.low) <= LEVELS.indexOf(r.level) && LEVELS.indexOf(r.level) <= LEVELS.indexOf(r.high));
});

test("все верно даёт высокий уровень, все неверно низкий", () => {
  const all = (ok: boolean) => LEVELS.flatMap((lv) => [1, 2, 3].map(() => ({ level: lv, correct: ok })));
  assert.ok(LEVELS.indexOf(readingEstimate(all(true)).level) >= 4);
  assert.ok(LEVELS.indexOf(readingEstimate(all(false)).level) <= 1);
});

test("словарь: честный ответ валиден, «да всем» невалиден", () => {
  const items = [
    ...LEVELS.flatMap((lv) => Array.from({ length: 8 }, (_, i) => ({ word: `${lv}w${i}`, real: true, level: lv }))),
    ...Array.from({ length: 16 }, (_, i) => ({ word: `ps${i}`, real: false, level: null })),
  ];
  const honest = Object.fromEntries(items.map((i) => [i.word, i.real]));
  const r = vocabScore(items, honest);
  assert.equal(r.valid, true);
  assert.equal(r.provisionalLevel, "C2");
  const yes = Object.fromEntries(items.map((i) => [i.word, true]));
  const r2 = vocabScore(items, yes);
  assert.equal(r2.valid, false);
  assert.equal(r2.provisionalLevel, null);
});

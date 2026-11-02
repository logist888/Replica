// Подсчёт баллов пилота. Без зависимостей, чтобы тестироваться напрямую через node --test.
// Должен давать те же значения, что engine/rasch.py (eap) и engine/vocab_form.py (score).

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];

// Предварительная сложность по уровню текста. Это допущение до калибровки по пилоту.
export const PRIOR_B: Record<Level, number> = { A1: -2.5, A2: -1.5, B1: -0.5, B2: 0.5, C1: 1.5, C2: 2.5 };

export function pCorrect(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)));
}

const GRID: number[] = [];
for (let i = -60; i <= 60; i++) GRID.push(i / 10);

export function eap(answers: Array<[number, 0 | 1]>, priorSd = 2.0): { theta: number; se: number } {
  if (answers.length === 0) return { theta: 0, se: priorSd };
  let den = 0;
  const post: number[] = [];
  for (const t of GRID) {
    let ll = -0.5 * (t / priorSd) ** 2;
    for (const [b, x] of answers) {
      const q = pCorrect(t, b);
      ll += Math.log(x ? q : 1 - q);
    }
    const w = Math.exp(ll);
    post.push(w);
    den += w;
  }
  let mean = 0;
  for (let i = 0; i < GRID.length; i++) mean += (post[i] * GRID[i]) / den;
  let v = 0;
  for (let i = 0; i < GRID.length; i++) v += (post[i] * (GRID[i] - mean) ** 2) / den;
  return { theta: mean, se: Math.sqrt(v) };
}

// Границы между уровнями на шкале theta: ПРЕДВАРИТЕЛЬНЫЕ, сдвигаются после калибровки.
const BOUNDS = [-2, -1, 0, 1, 2];
export function thetaToLevel(theta: number): Level {
  let k = 0;
  while (k < BOUNDS.length && theta >= BOUNDS[k]) k++;
  return LEVELS[k];
}

export function readingEstimate(items: Array<{ level: Level; correct: boolean }>) {
  const a: Array<[number, 0 | 1]> = items.map((i) => [PRIOR_B[i.level], i.correct ? 1 : 0]);
  const { theta, se } = eap(a);
  const low = thetaToLevel(theta - se);
  const high = thetaToLevel(theta + se);
  return { theta, se, level: thetaToLevel(theta), low, high, n: items.length };
}

export type VocabItem = { word: string; real: boolean; level: Level | null };

export function vocabScore(items: VocabItem[], said: Record<string, boolean>) {
  const pseudo = items.filter((i) => !i.real);
  const fa = pseudo.filter((i) => said[i.word]).length / Math.max(pseudo.length, 1);
  const levels: Record<string, { hit: number; corrected: number }> = {};
  for (const lv of LEVELS) {
    const its = items.filter((i) => i.real && i.level === lv);
    const h = its.filter((i) => said[i.word]).length / Math.max(its.length, 1);
    const corrected = fa < 1 ? Math.max(0, (h - fa) / (1 - fa)) : 0;
    levels[lv] = { hit: h, corrected };
  }
  let est: Level | null = null;
  for (const lv of LEVELS) {
    if (levels[lv].corrected >= 0.6) est = lv;
    else break;
  }
  return { falseAlarmRate: fa, levels, valid: fa <= 0.4, provisionalLevel: est };
}

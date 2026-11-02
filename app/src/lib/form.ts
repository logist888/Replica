import { LEVELS, type Level, type VocabItem } from "./scoring";
import { gaussian, sample, shuffle } from "./rng";
import type { Passage, VocabPool } from "./content";

const PER_LEVEL: Record<Level, number> = { A1: 4, A2: 8, B1: 8, B2: 8, C1: 8, C2: 8 };
const N_PSEUDO = 16;
export const N_READING_PASSAGES = 10;

export function buildVocabForm(pool: VocabPool): VocabItem[] {
  const items: VocabItem[] = [];
  for (const lv of LEVELS) {
    for (const w of sample(pool.real[lv], PER_LEVEL[lv])) items.push({ word: w, real: true, level: lv });
  }
  for (const w of sample(pool.pseudo, N_PSEUDO)) items.push({ word: w, real: false, level: null });
  return shuffle(items);
}

// Подбор текстов для калибровки: окрестность уровня, оценённого по словарю. Это таргетирование
// информативных заданий; оно не используется как результат. Неоценённый словарь -> уровень B1.
export function pickPassages(bank: Passage[], centerIdx: number | null, n = N_READING_PASSAGES): Passage[] {
  const c = centerIdx === null ? 2 : centerIdx;
  const byLevel: Record<string, Passage[]> = {};
  for (const lv of LEVELS) byLevel[lv] = shuffle(bank.filter((p) => p.level === lv));
  const chosen: Passage[] = [];
  let guard = 0;
  while (chosen.length < n && guard++ < 500) {
    const k = Math.min(LEVELS.length - 1, Math.max(0, Math.round(c + gaussian(1.1))));
    const next = byLevel[LEVELS[k]].shift();
    if (next) chosen.push(next);
  }
  // если уровни окрестности закончились, добираем любыми оставшимися
  if (chosen.length < n) {
    const rest = shuffle(LEVELS.flatMap((lv) => byLevel[lv]));
    while (chosen.length < n && rest.length) chosen.push(rest.shift()!);
  }
  return chosen.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
}

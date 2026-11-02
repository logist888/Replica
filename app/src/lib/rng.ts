import { randomBytes, randomInt } from "node:crypto";

export function token(): string {
  return randomBytes(16).toString("hex");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// Грубая нормальная величина (сумма равномерных), достаточно для выбора окрестности уровня.
export function gaussian(sd: number): number {
  let s = 0;
  for (let i = 0; i < 6; i++) s += randomInt(0, 1_000_000) / 1_000_000;
  return (s - 3) * sd * Math.sqrt(2);
}

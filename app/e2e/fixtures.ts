import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

export const ADMIN = process.env.ADMIN_TOKEN ?? "test-admin-token-0123456789";
const DB = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5544/pilot";

const root = path.join(process.cwd(), "..", "content");
export const pool = JSON.parse(readFileSync(path.join(root, "vocab", "pool.json"), "utf8"));
export const bank: Array<{ id: string; level: string; questions: Array<{ id: string; answer: number }> }> =
  readdirSync(path.join(root, "reading")).flatMap((f) => JSON.parse(readFileSync(path.join(root, "reading", f), "utf8")));
export const answerOf: Record<string, number> = {};
for (const p of bank) for (const q of p.questions) answerOf[q.id] = q.answer;
export const realWords = new Set<string>(Object.values(pool.real as Record<string, string[]>).flat());

let n = 0;
export function uniqueIp(): string {
  n += 1;
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(n / 250) % 250}.${n % 250}`;
}

export async function db<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

// Фикстура: уникальный IP на тест (чтобы ограничение частоты не мешало), а также проверки консоли и 5xx.
export const test = base.extend<{ guard: { errors: string[]; serverErrors: string[] } }>({
  guard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const serverErrors: string[] = [];
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
      page.on("console", (m) => {
        // ERR_INTERNET_DISCONNECTED: шум браузера в тесте обрыва сети (F01-E5), не дефект приложения.
        if (m.type() === "error" && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push("console: " + m.text());
      });
      page.on("response", (r) => {
        if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
      });
      page.on("dialog", (d) => d.accept());
      await page.context().setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
      await use({ errors, serverErrors });
      expect(serverErrors, "ответы 5xx").toEqual([]);
      expect(errors, "ошибки консоли").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export function api(request: APIRequestContext, ip = uniqueIp()) {
  const headers = { "x-forwarded-for": ip };
  return {
    post: async (url: string, data: unknown) => {
      const r = await request.post(url, { data, headers });
      return { status: r.status(), body: await r.json().catch(() => ({})) as any };
    },
    get: (url: string, h: Record<string, string> = {}) => request.get(url, { headers: { ...headers, ...h } }),
  };
}

// Прохождение через API до конкретного этапа. Знает реальные слова из пула (тестовый стенд, не клиент).
export async function startSession(a: ReturnType<typeof api>, background: object = {}) {
  const r = await a.post("/api/start", { consent: true, age16: true, background });
  expect(r.status).toBe(200);
  return { token: r.body.token as string, vocab: r.body.vocab as string[] };
}
export function honestVocab(words: string[]) {
  return Object.fromEntries(words.map((w) => [w, realWords.has(w)]));
}
export async function toReading(a: ReturnType<typeof api>) {
  const s = await startSession(a);
  const r = await a.post("/api/vocab", { token: s.token, answers: honestVocab(s.vocab), timeMs: 60000 });
  expect(r.status).toBe(200);
  return { ...s, passages: r.body.passages as Array<{ id: string; questions: Array<{ id: string }> }> };
}
export async function answerAll(a: ReturnType<typeof api>, s: { token: string; passages: any[] }, correct = true) {
  for (const p of s.passages) {
    const answers = p.questions.map((q: any) => ({ id: q.id, choice: correct ? answerOf[q.id] : (answerOf[q.id] + 1) % 4, timeMs: 3000 }));
    const x = await a.post("/api/reading", { token: s.token, answers });
    expect(x.status).toBe(200);
  }
}

// Завершение через API с учётом части 3: если записи есть, проходим и её (ответ 0 на все вопросы).
export async function finishViaApi(a: ReturnType<typeof api>, s: { token: string }) {
  const l = await a.post("/api/listening/start", { token: s.token });
  if (l.status === 200 && !l.body.skip) {
    for (const it of l.body.items) {
      const r = await a.post("/api/listening", { token: s.token, answers: it.questions.map((q: any) => ({ id: q.id, choice: 0, timeMs: 500 })) });
      expect(r.status).toBe(200);
    }
  }
  return a.post("/api/finish", { token: s.token });
}

// После последнего текста: либо сразу результат, либо экран аудирования. Проходим его, не воспроизводя звук.
export async function afterReadingUI(page: Page) {
  const rec = page.getByText(/Recording 1 of/);
  await Promise.race([page.waitForURL(/\/result\//), rec.waitFor()]);
  if (await rec.isVisible().catch(() => false)) {
    for (let c = 0; c < 4; c++) {
      await expect(page.getByText(`Recording ${c + 1} of 4`)).toBeVisible();
      const groups = page.getByRole("radiogroup");
      for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).locator("label").nth(i % 4).click();
      await page.getByRole("button", { name: c < 3 ? "Next recording" : "Finish" }).click();
    }
  }
}

export async function completeVocabUI(page: Page, knowAll = false) {
  for (let k = 0; k < 60; k++) {
    await expect(page.getByText(`Word ${k + 1} of 60`)).toBeVisible();
    const word = (await page.locator(".word").textContent())!.trim();
    const yes = knowAll || realWords.has(word);
    await page.getByRole("button", { name: yes ? "Yes, I know it" : "No / not sure" }).click();
  }
}

export async function acceptIntro(page: Page) {
  await page.goto("/test");
  await page.getByLabel("I am at least 16 years old.").check();
  await page.getByLabel(/I agree that my answers/).check();
  await page.getByRole("button", { name: "Start Part 1" }).click();
  await expect(page.locator(".word")).toBeVisible();
}

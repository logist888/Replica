import { test, expect, api, toReading, answerAll, db, acceptIntro, completeVocabUI, answerOf } from "./fixtures";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const have =
  existsSync(path.join(process.cwd(), "content", "listening")) &&
  existsSync(path.join(process.cwd(), "content", "audio")) &&
  readdirSync(path.join(process.cwd(), "content", "audio")).length > 0;

test.use({ viewport: { width: 390, height: 844 } });
test.skip(!have, "нет сценариев аудирования или аудио: часть 3 в пилоте выключена");

async function toListening(request: any) {
  const a = api(request);
  const s = await toReading(a);
  await answerAll(a, s);
  const l = await a.post("/api/listening/start", { token: s.token });
  expect(l.status).toBe(200);
  expect(l.body.items.length).toBe(4);
  return { a, s, items: l.body.items as Array<{ id: string; plays: number; questions: Array<{ id: string }> }> };
}

test("F03-H1 API: аудирование проходится и попадает в результат и выгрузку", async ({ request, page }) => {
  const { a, s, items } = await toListening(request);
  expect(JSON.stringify(items)).not.toMatch(/"answer"|"transcript"/);
  for (const it of items) {
    const r = await a.post("/api/listening", { token: s.token, answers: it.questions.map((q) => ({ id: q.id, choice: 0, timeMs: 1000 })) });
    expect(r.status).toBe(200);
  }
  const f = await a.post("/api/finish", { token: s.token });
  expect(f.status).toBe(200);
  await page.goto(f.body.url);
  await expect(page.getByRole("heading", { name: "Listening" })).toBeVisible();
  const row = await db("select results->'listening'->>'answered' n from sessions where token=$1", [s.token]);
  expect(Number(row[0].n)).toBe(12);
});

test("F03-N1 нельзя завершить, пропустив аудирование, и нельзя начать его без чтения", async ({ request }) => {
  const a = api(request);
  const s = await toReading(a);
  expect((await a.post("/api/listening/start", { token: s.token })).status).toBe(409); // чтение не пройдено
  await answerAll(a, s);
  expect((await a.post("/api/finish", { token: s.token })).status).toBe(409); // аудирование обязательно
});

test("F03-N2 аудио: только владельцу, только его сценарии, только в части 3", async ({ request }) => {
  const { a, s, items } = await toListening(request);
  const id = items[0].id;
  expect((await request.get(`/api/audio/${id}`)).status()).toBe(404); // без токена
  expect((await request.get(`/api/audio/${id}?token=${"0".repeat(32)}`)).status()).toBe(404);
  const other = await toReading(api(request)); // чужая сессия, ещё не в части 3
  expect((await request.get(`/api/audio/${id}?token=${other.token}`)).status()).toBe(404);
  expect((await request.get(`/api/audio/..%2F..%2Fpilot.sql?token=${s.token}`)).status()).toBe(404); // обход пути
  expect((await request.get(`/api/audio/L-C2-99?token=${s.token}`)).status()).toBe(404); // не из формы
  const ok = await request.get(`/api/audio/${id}?token=${s.token}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["cache-control"]).toMatch(/no-store/);
  expect(ok.headers()["accept-ranges"]).toBe("bytes");
});

test("F03-E1 Range-запросы (нужны Safari)", async ({ request }) => {
  const { s, items } = await toListening(request);
  const url = `/api/audio/${items[0].id}?token=${s.token}`;
  const full = await request.get(url);
  const size = (await full.body()).length;
  const part = await request.get(url, { headers: { range: "bytes=0-99" } });
  expect(part.status()).toBe(206);
  expect(part.headers()["content-range"]).toBe(`bytes 0-99/${size}`);
  expect((await part.body()).length).toBe(100);
  const tail = await request.get(url, { headers: { range: "bytes=-50" } });
  expect(tail.status()).toBe(206);
  expect((await tail.body()).length).toBe(50);
  expect((await request.get(url, { headers: { range: `bytes=${size + 10}-` } })).status()).toBe(416);
  expect((await request.get(url, { headers: { range: "bytes=abc" } })).status()).toBe(416);
});

test("F03-E2 после завершения аудио недоступно", async ({ request }) => {
  const { a, s, items } = await toListening(request);
  for (const it of items) await a.post("/api/listening", { token: s.token, answers: it.questions.map((q) => ({ id: q.id, choice: 0 })) });
  await a.post("/api/finish", { token: s.token });
  expect((await request.get(`/api/audio/${items[0].id}?token=${s.token}`)).status()).toBe(404);
});

test("F03-N3 ответы аудирования: чужой вопрос, повтор и неверный выбор", async ({ request }) => {
  const { a, s, items } = await toListening(request);
  const q = items[0].questions[0].id;
  expect((await a.post("/api/listening", { token: s.token, answers: [{ id: q, choice: 9 }] })).status).toBe(400);
  expect((await a.post("/api/listening", { token: s.token, answers: [{ id: "R-A1-01-1", choice: 0 }] })).status).toBe(400);
  expect((await a.post("/api/listening", { token: s.token, answers: [{ id: q, choice: 0 }] })).status).toBe(200);
  expect((await a.post("/api/listening", { token: s.token, answers: [{ id: q, choice: 1 }] })).status).toBe(200);
  const r = await db("select answer from responses where item_id=$1 and session_id=(select id from sessions where token=$2)", [q, s.token]);
  expect(r).toEqual([{ answer: "0" }]); // первый ответ сохраняется
});

test("F03-H2 UI: полный путь с аудио, лимит прослушиваний соблюдается", async ({ page }) => {
  await acceptIntro(page);
  await completeVocabUI(page);
  for (let t = 0; t < 10; t++) {
    await expect(page.getByText(/Text \d+ of 10/)).toBeVisible();
    const groups = page.getByRole("radiogroup");
    for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).locator("label").nth(i % 4).click();
    await page.getByRole("button", { name: t < 9 ? "Next text" : "Finish" }).click();
  }
  for (let c = 0; c < 4; c++) {
    await expect(page.getByText(`Recording ${c + 1} of 4`)).toBeVisible();
    const hint = await page.getByText(/You can play this recording/).textContent();
    const plays = /once/.test(hint!) ? 1 : Number(/(\d) times/.exec(hint!)![1]);
    for (let p = 0; p < plays; p++) {
      await page.getByRole("button", { name: "Play audio" }).click();
      await expect(page.getByText(`Plays left: ${plays - p - 1}`)).toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByRole("button", { name: "No plays left" })).toBeDisabled();
    const groups = page.getByRole("radiogroup");
    for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).locator("label").nth(i % 4).click();
    await page.getByRole("button", { name: c < 3 ? "Next recording" : "Finish" }).click();
  }
  await expect(page).toHaveURL(/\/result\/[0-9a-f]{32}$/);
  await expect(page.getByRole("heading", { name: "Listening" })).toBeVisible();
});

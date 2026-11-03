import { test, expect, api, toReading, answerAll, db, ADMIN, finishViaApi } from "./fixtures";

async function finished(request: any, correct = true) {
  const a = api(request);
  const s = await toReading(a);
  await answerAll(a, s, correct);
  const f = await finishViaApi(a, s);
  return { token: s.token as string, url: f.body.url as string, a };
}

test("F02-H1 результат открывается по ссылке и помечен как предварительный", async ({ page, request }) => {
  const r = await finished(request);
  await page.goto(r.url);
  await expect(page.getByRole("heading", { name: "Your pilot result" })).toBeVisible();
  await expect(page.getByText(/Provisional estimate/)).toBeVisible();
  await expect(page.getByText(/not an official certificate/i)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("F02-E1 E3 неверные токены дают 404", async ({ request }) => {
  for (const t of ["abc", "g".repeat(32), "0".repeat(32), "../etc/passwd", "0".repeat(64)]) {
    const r = await request.get("/result/" + encodeURIComponent(t));
    expect(r.status(), t).toBe(404);
  }
});

test("F02-E2 незавершённая сессия не показывает результат", async ({ request }) => {
  const s = await toReading(api(request));
  expect((await request.get("/result/" + s.token)).status()).toBe(404);
});

test("F02-E5 разные ответы дают разные диапазоны (все верно выше, чем все неверно)", async ({ request }) => {
  const hi = await finished(request, true);
  const lo = await finished(request, false);
  const t = async (u: string) => Number((await db("select (results->'reading'->>'theta')::float t from sessions where token=$1", [u.split("/").pop()!]))[0].t);
  expect(await t(hi.url)).toBeGreaterThan(await t(lo.url));
});

test("F05-N1 выгрузка без токена и с неверным токеном недоступна", async ({ request }) => {
  for (const h of [{}, { authorization: "Bearer nope" }, { authorization: "Bearer " + "x".repeat(ADMIN.length) }, { authorization: ADMIN.slice(0, 5) }]) {
    for (const kind of ["sessions", "responses"]) {
      expect((await request.get("/api/admin/export?kind=" + kind, { headers: h as any })).status()).toBe(404);
    }
  }
});

test("F05-H1 E1 выгрузка: только завершённые сессии, числа не искажены", async ({ request }) => {
  await db("delete from participants");
  const a = await finished(request, true);
  const a2 = api(request);
  const unfinished = await toReading(a2); // не завершена
  const auth = { authorization: "Bearer " + ADMIN };
  const sess = await (await request.get("/api/admin/export?kind=sessions", { headers: auth })).text();
  const lines = sess.trim().split("\n");
  expect(lines[0]).toContain("session_id,started_at");
  expect(lines.length).toBe(2);
  expect(sess).not.toContain(unfinished.token);
  const resp = await (await request.get("/api/admin/export?kind=responses", { headers: auth })).text();
  const listeningRows = (await db("select count(*)::int n from responses where part='listening'"))[0].n;
  expect(resp.trim().split("\n").length).toBe(1 + 60 + 30 + listeningRows);
  const col = lines[1].split(",");
  const theta = col[lines[0].split(",").indexOf("reading_theta")];
  expect(Number.isFinite(Number(theta))).toBe(true);
  expect((await request.get("/api/admin/export?kind=other", { headers: auth })).status()).toBe(404);
});

test("F05-E1b формулы в свободных полях нейтрализуются в выгрузке", async ({ request }) => {
  await db("delete from participants");
  const a = api(request);
  const st = await a.post("/api/start", { consent: true, age16: true, background: { extTest: "other", extScore: "=HYPERLINK(1)", nativeLanguage: "@evil" } });
  const vv = await a.post("/api/vocab", { token: st.body.token, answers: Object.fromEntries(st.body.vocab.map((w: string) => [w, true])) });
  for (const p of vv.body.passages) await a.post("/api/reading", { token: st.body.token, answers: p.questions.map((q: any) => ({ id: q.id, choice: 0 })) });
  await finishViaApi(a, { token: st.body.token });
  const csv = await (await request.get("/api/admin/export?kind=sessions", { headers: { authorization: "Bearer " + ADMIN } })).text();
  expect(csv).toContain("'=HYPERLINK(1)");
  expect(csv).toContain("'@evil");
});

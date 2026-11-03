import { test, expect, api, startSession, honestVocab, toReading, answerAll, db, answerOf, ADMIN, finishViaApi } from "./fixtures";

test("F01-E1b API: старт без согласия или возраста отклоняется", async ({ request }) => {
  const a = api(request);
  expect((await a.post("/api/start", { consent: false, age16: true })).status).toBe(400);
  expect((await a.post("/api/start", { consent: true, age16: false })).status).toBe(400);
  expect((await a.post("/api/start", {})).status).toBe(400);
  const r = await request.post("/api/start", { data: "not json", headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" } });
  expect(r.status()).toBe(400);
});

test("F01-E6b мусор в анкете нейтрализуется", async ({ request }) => {
  const a = api(request);
  const s = await startSession(a, { yearsLearning: 9999, selfLevel: "Z9", extTest: "hack", extScore: "=cmd", nativeLanguage: "  " });
  const r = await db("select years_learning, self_level, ext_test, ext_score, native_language from participants where id=(select participant_id from sessions where token=$1)", [s.token]);
  expect(r[0]).toEqual({ years_learning: null, self_level: null, ext_test: null, ext_score: null, native_language: null });
});

test("F01-E9 устаревшая сессия отклоняется", async ({ request }) => {
  const a = api(request);
  const s = await startSession(a);
  await db("update sessions set started_at = now() - interval '4 hours' where token=$1", [s.token]);
  const r = await a.post("/api/vocab", { token: s.token, answers: honestVocab(s.vocab) });
  expect(r.status).toBe(404);
  expect(r.body.error).toMatch(/expired/i);
});

test("F01-N1 часть 1: не все слова, посторонние слова, не булевы значения", async ({ request }) => {
  const a = api(request);
  const s = await startSession(a);
  expect((await a.post("/api/vocab", { token: s.token, answers: {} })).status).toBe(400);
  const partial = honestVocab(s.vocab);
  delete (partial as any)[s.vocab[0]];
  expect((await a.post("/api/vocab", { token: s.token, answers: partial })).status).toBe(400);
  const strs = Object.fromEntries(s.vocab.map((w) => [w, "yes"]));
  expect((await a.post("/api/vocab", { token: s.token, answers: strs })).status).toBe(400);
  expect((await a.post("/api/vocab", { token: s.token, answers: null })).status).toBe(400);
});

test("F01-N2 N3 повтор части 1 и чтение до части 1", async ({ request }) => {
  const a = api(request);
  const s = await startSession(a);
  expect((await a.post("/api/reading", { token: s.token, answers: [{ id: "R-A1-01-1", choice: 0 }] })).status).toBe(409);
  const ok = await a.post("/api/vocab", { token: s.token, answers: honestVocab(s.vocab), timeMs: 1000 });
  expect(ok.status).toBe(200);
  expect((await a.post("/api/vocab", { token: s.token, answers: honestVocab(s.vocab) })).status).toBe(409);
});

test("F01-N4 чтение: неверный выбор, чужой вопрос, пустой и огромный список", async ({ request }) => {
  const a = api(request);
  const s = await toReading(a);
  const q = s.passages[0].questions[0].id;
  expect((await a.post("/api/reading", { token: s.token, answers: [{ id: q, choice: 7 }] })).status).toBe(400);
  expect((await a.post("/api/reading", { token: s.token, answers: [{ id: q, choice: -1 }] })).status).toBe(400);
  expect((await a.post("/api/reading", { token: s.token, answers: [{ id: q, choice: "1" }] })).status).toBe(400);
  expect((await a.post("/api/reading", { token: s.token, answers: [] })).status).toBe(400);
  expect((await a.post("/api/reading", { token: s.token, answers: Array(11).fill({ id: q, choice: 0 }) })).status).toBe(400);
  const inForm = new Set(s.passages.flatMap((p) => p.questions.map((x) => x.id)));
  const foreign = Object.keys(answerOf).find((id) => !inForm.has(id))!;
  expect((await a.post("/api/reading", { token: s.token, answers: [{ id: foreign, choice: 0 }] })).status).toBe(400);
  const none = await db("select count(*)::int n from responses where part='reading' and session_id=(select id from sessions where token=$1)", [s.token]);
  expect(none[0].n).toBe(0);
});

test("F01-N5 завершение: до чтения нельзя, повторно та же ссылка", async ({ request }) => {
  const a = api(request);
  const s = await toReading(a);
  expect((await a.post("/api/finish", { token: s.token })).status).toBe(409);
  await answerAll(a, s);
  const f1 = await finishViaApi(a, s);
  const f2 = await a.post("/api/finish", { token: s.token });
  expect(f1.status).toBe(200);
  expect(f2.body.url).toBe(f1.body.url);
});

test("F01-N6 повторный ответ на тот же вопрос не перезаписывает первый", async ({ request }) => {
  const a = api(request);
  const s = await toReading(a);
  const q = s.passages[0].questions[0].id;
  await a.post("/api/reading", { token: s.token, answers: [{ id: q, choice: answerOf[q] }] });
  await a.post("/api/reading", { token: s.token, answers: [{ id: q, choice: (answerOf[q] + 1) % 4 }] });
  const r = await db("select is_correct from responses where item_id=$1 and session_id=(select id from sessions where token=$2)", [q, s.token]);
  expect(r).toEqual([{ is_correct: true }]);
});

test("F01-N7 ответы с ключами не уходят клиенту", async ({ request }) => {
  const a = api(request);
  const st = await a.post("/api/start", { consent: true, age16: true });
  expect(JSON.stringify(st.body)).not.toMatch(/"real"|"level"|"answer"|"pseudo"/);
  const v = await a.post("/api/vocab", { token: st.body.token, answers: honestVocab(st.body.vocab) });
  expect(JSON.stringify(v.body)).not.toMatch(/"answer"|"correct"|"level"/);
});

test("F01-N8 ограничение частоты: 429 после 30 стартов с одного IP", async ({ request }) => {
  const ip = "10.250.250.250";
  const a = api(request, ip);
  let last = 0;
  for (let i = 0; i < 31; i++) last = (await a.post("/api/start", { consent: true, age16: true })).status;
  expect(last).toBe(429);
});

test("F01-N9 токен в чужом формате не принимается ни одним маршрутом", async ({ request }) => {
  const a = api(request);
  for (const t of ["", "x", "0".repeat(31), "G".repeat(32), "0".repeat(33), "' or 1=1 --", null, 5, {}]) {
    for (const route of ["vocab", "reading", "finish"]) {
      const r = await a.post("/api/" + route, { token: t, answers: [] });
      expect(r.status, `${route} ${JSON.stringify(t)}`).toBe(404);
    }
  }
});

test("F01-E10 одновременные запросы: параллельная отправка части 1 даёт один успех", async ({ request }) => {
  const a = api(request);
  const s = await startSession(a);
  const body = { token: s.token, answers: honestVocab(s.vocab), timeMs: 1000 };
  const rs = await Promise.all([a.post("/api/vocab", body), a.post("/api/vocab", body), a.post("/api/vocab", body)]);
  const codes = rs.map((r) => r.status).sort();
  expect(codes.filter((c) => c === 200).length).toBe(1);
  const n = await db("select count(*)::int n from responses where part='vocab' and session_id=(select id from sessions where token=$1)", [s.token]);
  expect(n[0].n).toBe(60);
});

test("F01-N8b ограничение частоты нельзя обойти подделкой левой части X-Forwarded-For", async ({ request }) => {
  // За прокси реальный адрес клиента — последний элемент (прокси его дописывает). Левые элементы задаёт клиент.
  const real = "10.251.251." + (1 + Math.floor(Math.random() * 250));
  let last = 0;
  for (let i = 0; i < 31; i++) {
    const r = await request.post("/api/start", {
      data: { consent: true, age16: true },
      headers: { "x-forwarded-for": `203.0.113.${i + 1}, ${real}` },
    });
    last = r.status();
  }
  expect(last).toBe(429);
});

import { test, expect, acceptIntro, completeVocabUI, db, afterReadingUI } from "./fixtures";
import type { Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

async function readingScreen(page: Page, answerCorrect = true) {
  await expect(page.getByText(/Text \d+ of 10/)).toBeVisible();
  const groups = page.getByRole("radiogroup");
  const n = await groups.count();
  for (let i = 0; i < n; i++) await groups.nth(i).locator("label").nth(i % 4).click();
}

test("F01-H1 полный путь с мобильного экрана", async ({ page }) => {
  await page.goto("/ru");
  await page.getByRole("link", { name: "Пройти тест" }).first().click();
  await expect(page).toHaveURL(/\/test$/);
  await page.getByLabel("I am at least 16 years old.").check();
  await page.getByLabel(/I agree that my answers/).check();
  await page.getByLabel("Native language").fill("Russian");
  await page.getByLabel("Have you taken another English test?").selectOption("ielts");
  await page.getByLabel("Your score or level in that test").fill("6.5");
  await page.getByRole("button", { name: "Start Part 1" }).click();
  await completeVocabUI(page);
  for (let t = 0; t < 10; t++) {
    await readingScreen(page);
    await page.getByRole("button", { name: t < 9 ? "Next text" : "Finish" }).click();
  }
  await afterReadingUI(page);
  await expect(page).toHaveURL(/\/result\/[0-9a-f]{32}$/);
  await expect(page.getByText(/Provisional estimate/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reading" })).toBeVisible();
  const token = page.url().split("/").pop()!;
  const rows = await db("select part, count(*)::int n from responses r join sessions s on s.id=r.session_id where s.token=$1 group by part order by part", [token]);
  expect(rows.filter((r: any) => r.part !== "listening")).toEqual([{ part: "reading", n: 30 }, { part: "vocab", n: 60 }]);
  const s = await db("select status, user_agent, results from sessions where token=$1", [token]);
  expect(s[0].status).toBe("done");
  expect(s[0].user_agent.length).toBeLessThanOrEqual(200);
  const p = await db("select native_language, ext_test, ext_score from participants where id=(select participant_id from sessions where token=$1)", [token]);
  expect(p[0]).toEqual({ native_language: "Russian", ext_test: "ielts", ext_score: "6.5" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("F01-E1 старт невозможен без согласия", async ({ page }) => {
  await page.goto("/test");
  const start = page.getByRole("button", { name: "Start Part 1" });
  await expect(start).toBeDisabled();
  await page.getByLabel("I am at least 16 years old.").check();
  await expect(start).toBeDisabled();
  await page.getByLabel(/I agree that my answers/).check();
  await expect(start).toBeEnabled();
});

test("F01-E2 двойной клик по ответу засчитывает одно слово", async ({ page }) => {
  await acceptIntro(page);
  await expect(page.getByText("Word 1 of 60")).toBeVisible();
  await page.getByRole("button", { name: "No / not sure" }).dblclick();
  await expect(page.getByText(/Word \d+ of 60/)).toHaveText("Word 2 of 60");
});

test("F01-E3 двойной клик по «Next text» переводит на один текст", async ({ page }) => {
  await acceptIntro(page);
  await completeVocabUI(page);
  await readingScreen(page);
  await page.getByRole("button", { name: "Next text" }).dblclick();
  await expect(page.getByText("Text 2 of 10")).toBeVisible();
  const reqs = await db("select count(*)::int n from responses where part='reading' and session_id=(select id from sessions order by started_at desc limit 1)");
  expect(reqs[0].n).toBe(3);
});

test("F01-E4 перезагрузка посреди части 1 возвращает на экран согласия", async ({ page }) => {
  await acceptIntro(page);
  await page.getByRole("button", { name: "No / not sure" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  const open = await db("select count(*)::int n from sessions where status='vocab'");
  expect(open[0].n).toBeGreaterThan(0);
});

test("F01-E5 обрыв сети при отправке части 1: сообщение и повтор", async ({ page, context }) => {
  await acceptIntro(page);
  for (let k = 0; k < 59; k++) {
    await expect(page.getByText(`Word ${k + 1} of 60`)).toBeVisible();
    await page.getByRole("button", { name: "No / not sure" }).click();
  }
  await expect(page.getByText("Word 60 of 60")).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "No / not sure" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible(); // у Next есть пустой role=alert (route announcer)
  await context.setOffline(false);
  await page.getByRole("button", { name: "No / not sure" }).click();
  await expect(page.getByText(/Text 1 of 10/)).toBeVisible();
});

test("F01-E6 длинные строки и эмодзи в анкете не ломают старт", async ({ page }) => {
  await page.goto("/test");
  await page.getByLabel("I am at least 16 years old.").check();
  await page.getByLabel(/I agree that my answers/).check();
  await page.getByLabel("Native language").fill("😀".repeat(30) + "x".repeat(200));
  await page.getByLabel("Years of studying English").fill("12");
  await page.getByRole("button", { name: "Start Part 1" }).click();
  await expect(page.locator(".word")).toBeVisible();
  const r = await db("select native_language from participants order by created_at desc limit 1");
  expect(r[0].native_language.length).toBeLessThanOrEqual(40);
});

test("F01-E7 клавиатура: согласие, старт и выбор вариантов", async ({ page }) => {
  await page.goto("/test");
  await page.getByLabel("I am at least 16 years old.").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(page.getByLabel(/I agree that my answers/)).toBeChecked();
  await page.getByRole("button", { name: "Start Part 1" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".word")).toBeVisible();
  await page.getByRole("button", { name: "No / not sure" }).focus();
  const outline = await page.getByRole("button", { name: "No / not sure" }).evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(outline).not.toBe("none");
  await completeVocabUI(page);
  await expect(page.getByText(/Text 1 of 10/)).toBeVisible();
  const first = page.getByRole("radiogroup").first().getByRole("radio").first();
  await first.focus();
  await page.keyboard.press("ArrowDown");
  const checked = await page.getByRole("radiogroup").first().getByRole("radio", { checked: true }).count();
  expect(checked).toBe(1);
});

test("F01-E8 цели касания не меньше 44 px", async ({ page }) => {
  await acceptIntro(page);
  for (const name of ["Yes, I know it", "No / not sure"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await completeVocabUI(page);
  const labels = page.getByRole("radiogroup").first().locator("label");
  for (let i = 0; i < (await labels.count()); i++) {
    const box = await labels.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

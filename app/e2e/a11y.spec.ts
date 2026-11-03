import { test, expect, acceptIntro, completeVocabUI, api, toReading, answerAll, finishViaApi } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

async function scan(page: any, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const summary = r.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].html.slice(0, 120)}`);
  expect(summary, name).toEqual([]);
}

test("a11y: лендинги и приватность", async ({ page }) => {
  for (const u of ["/", "/ru", "/en", "/ru/privacy", "/en/privacy"]) {
    await page.goto(u);
    await scan(page, u);
  }
});

test("a11y: согласие, слово, чтение", async ({ page }) => {
  await page.goto("/test");
  await scan(page, "intro");
  await acceptIntro(page);
  await scan(page, "vocab");
  await completeVocabUI(page);
  await expect(page.getByText(/Text 1 of 10/)).toBeVisible();
  await scan(page, "reading");
});

test("a11y: результат", async ({ page, request }) => {
  const a = api(request);
  const s = await toReading(a);
  await answerAll(a, s);
  const f = await finishViaApi(a, s);
  await page.goto(f.body.url);
  await scan(page, "result");
});

test("a11y: экран аудирования", async ({ page }) => {
  const { existsSync, readdirSync } = await import("node:fs");
  const path = await import("node:path");
  const audio = path.join(process.cwd(), "content", "audio");
  test.skip(!existsSync(audio) || readdirSync(audio).length === 0, "нет аудио: часть 3 выключена");
  await acceptIntro(page);
  await completeVocabUI(page);
  for (let t = 0; t < 10; t++) {
    await expect(page.getByText(/Text \d+ of 10/)).toBeVisible();
    const groups = page.getByRole("radiogroup");
    for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).locator("label").nth(i % 4).click();
    await page.getByRole("button", { name: t < 9 ? "Next text" : "Finish" }).click();
  }
  await expect(page.getByText("Recording 1 of 4")).toBeVisible();
  await scan(page, "listening");
});

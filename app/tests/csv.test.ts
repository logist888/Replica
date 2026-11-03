import { test } from "node:test";
import assert from "node:assert/strict";

// Копия правила из admin/export: отрицательные числа не искажаются, формулы нейтрализуются.
const guard = (s: string) => (/^([=+@\t\r]|-(?![\d.]))/.test(s) && !/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s) ? "'" + s : s);

test("числа не трогаем", () => {
  assert.equal(guard("-2.2101314106302574"), "-2.2101314106302574");
  assert.equal(guard("6.5"), "6.5");
  assert.equal(guard("1e-5"), "1e-5");
});
test("формулы нейтрализуем", () => {
  assert.equal(guard("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
  assert.equal(guard("@SUM(1)"), "'@SUM(1)");
  assert.equal(guard("-cmd"), "'-cmd");
  assert.equal(guard("+1+1x"), "'+1+1x");
});

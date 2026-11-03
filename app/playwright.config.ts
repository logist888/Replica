import { defineConfig } from "@playwright/test";

const PORT = 3100;
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Предустановленный Chromium; версия Playwright должна совпадать с установленной в окружении.
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" },
  },
  webServer: {
    command: "npx next start -p " + PORT,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres@localhost:5544/pilot",
      ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? "test-admin-token-0123456789",
      PGSSL: "",
    },
  },
});

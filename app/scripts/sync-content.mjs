// Копирует content/ из корня репозитория в app/content/ (для сборки и деплоя из каталога app).
import { cpSync, existsSync } from "node:fs";
const src = new URL("../../content", import.meta.url);
const dst = new URL("../content", import.meta.url);
if (existsSync(src)) {
  cpSync(src, dst, { recursive: true });
  console.log("content synced");
} else {
  console.log("no ../content, using app/content as is");
}

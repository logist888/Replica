// ТОЛЬКО ДЛЯ АВТОТЕСТОВ: создаёт короткие WAV-файлы с тоном вместо настоящих записей в app/content/audio.
// Настоящие записи (content/audio/<id>.mp3 и т.п.) этот скрипт не трогает и не перезаписывает.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "content");
const out = path.join(root, "audio");
const dir = path.join(root, "listening");
if (!existsSync(dir)) {
  console.log("no listening scripts, nothing to do");
  process.exit(0);
}
mkdirSync(out, { recursive: true });

function wav(seconds, freq = 440, rate = 8000) {
  const n = Math.floor(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 3000), 44 + i * 2);
  return buf;
}
let made = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  for (const s of JSON.parse(readFileSync(path.join(dir, f), "utf8"))) {
    const exists = ["mp3", "m4a", "ogg", "webm", "wav"].some((e) => existsSync(path.join(out, `${s.id}.${e}`)));
    if (!exists) {
      writeFileSync(path.join(out, `${s.id}.wav`), wav(1.2));
      made++;
    }
  }
}
console.log("test audio written:", made);

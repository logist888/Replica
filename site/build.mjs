// Собирает статический сайт для GitHub Pages в корень репозитория: index.html, pages/, assets/.
// Банк заданий и ключи ответов на сайт НЕ попадают: берутся только числа.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { marked } from "marked";

const repo = path.resolve(import.meta.dirname, "..");
const out = repo;
const rd = (p) => readFileSync(path.join(repo, p), "utf8");

const DOCS = [
  ["recon", "replica/recon.md", "Разведка EF SET", "Что известно об оригинале по публичным страницам и что нельзя копировать."],
  ["architecture", "replica/architecture.md", "Архитектура", "Стек, схема данных, API, контент и калибровка."],
  ["methodology", "replica/methodology.md", "Методология", "Какие открытые источники можно использовать, симуляции, решения."],
  ["design", "replica/design/components.md", "Дизайн-система", "Компоненты теста, состояния, доступность."],
  ["test-plan", "replica/test/test-plan.md", "План тестирования", "Случаи по потокам: прохождение, результат, выгрузка, аудирование."],
  ["bugs", "replica/test/bugs.md", "Найденные баги", "Что нашли, что исправили, что осталось проверить."],
  ["listening-guide", "replica/listening-recording-guide.md", "Руководство по записи аудирования", "Как озвучить 36 сценариев."],
];

const css = rd("replica/design/tokens.css");
mkdirSync(path.join(out, "assets"), { recursive: true });
mkdirSync(path.join(out, "pages"), { recursive: true });
writeFileSync(path.join(out, "assets/tokens.css"), css);
writeFileSync(path.join(out, "assets/site.css"), `
@import "tokens.css";
*{box-sizing:border-box}
body{margin:0;background:var(--color-bg);color:var(--color-text);font:400 16px/26px var(--font-sans)}
a{color:var(--color-accent)}
header.top{border-bottom:1px solid var(--color-border);background:var(--color-surface)}
.wrap{max-width:860px;margin:0 auto;padding:24px 16px 64px}
header.top .wrap{padding:12px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
header.top strong{margin-right:auto}
h1{font-size:32px;line-height:38px;margin:24px 0 12px}h2{font-size:22px;line-height:30px;margin:32px 0 8px}h3{font-size:18px;margin:24px 0 6px}
.muted{color:var(--color-text-muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin:16px 0}
.card{background:var(--color-surface-raised);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:16px;box-shadow:var(--shadow-card)}
.card h3{margin:0 0 4px}.card p{margin:0}
.stat{font:700 34px/38px var(--font-sans)}
.badge{display:inline-block;padding:1px 10px;border-radius:999px;font:600 13px/20px var(--font-sans);background:var(--color-cefr-a2-bg)}
.warn{background:var(--color-warning-bg);color:var(--color-warning);padding:12px 16px;border-radius:var(--radius-md)}
table{border-collapse:collapse;width:100%;font-size:14px;line-height:20px;display:block;overflow-x:auto}
th,td{border:1px solid var(--color-border);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--color-surface)}
pre{background:var(--color-surface);padding:12px;border-radius:var(--radius-md);overflow-x:auto;font-size:13px;line-height:19px}
code{font-family:var(--font-mono);font-size:.92em}
blockquote{margin:12px 0;padding:4px 16px;border-left:4px solid var(--color-border)}
img{max-width:100%}
`);

const shell = (title, body, depth) => {
  const up = depth ? "../" : "";
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><link rel="stylesheet" href="${up}assets/site.css"></head><body>
<header class="top"><div class="wrap"><strong>Открытый тест английского</strong><a href="${up}index.html">Статус</a><a href="https://github.com/logist888/Replica">GitHub</a></div></header>
<main class="wrap">${body}</main></body></html>`;
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
for (const [slug, file, title] of DOCS) {
  const html = marked.parse(rd(file));
  writeFileSync(path.join(out, "pages", slug + ".html"), shell(esc(title), `<p class="muted"><a href="../index.html">← Статус проекта</a></p>${html}`, 1));
}

// превью дизайн-системы (самодостаточное): preview.html + токены
const dp = path.join(out, "pages/design-preview");
mkdirSync(dp, { recursive: true });
for (const f of ["preview.html", "tokens.css", "tokens.js", "tokens.json"]) cpSync(path.join(repo, "replica/design", f), path.join(dp, f));
cpSync(path.join(dp, "preview.html"), path.join(dp, "index.html"));

// числа из репозитория (ключи ответов не читаем)
const readJson = (p) => JSON.parse(rd(p));
const count = (dir) => {
  let items = 0, questions = 0;
  for (const f of readdirSync(path.join(repo, dir)).filter((x) => x.endsWith(".json"))) {
    for (const p of readJson(path.join(dir, f))) { items++; questions += p.questions.length; }
  }
  return { items, questions };
};
const reading = count("content/reading");
const listening = count("content/listening");
const pool = readJson("content/vocab/pool.json");
const realWords = Object.values(pool.real).reduce((a, v) => a + v.length, 0);
const today = new Date().toISOString().slice(0, 10);

const cards = DOCS.map(([slug, , title, desc]) => `<a class="card" style="text-decoration:none;color:inherit" href="pages/${slug}.html"><h3>${title}</h3><p class="muted">${desc}</p></a>`).join("\n");
const index = `
<h1>Открытый бесплатный тест английского</h1>
<p class="muted">Ход работ. Обновлено ${today}. Репозиторий: <a href="https://github.com/logist888/Replica">logist888/Replica</a>.</p>
<p class="warn">Это пилот: задания ещё не откалиброваны, уровни CEFR условные. Публичной версии теста пока нет, сайт показывает документы и макеты. Сам тест (Next.js + Postgres) требует сервера и размещается отдельно от этих страниц.</p>

<h2>Что готово</h2>
<div class="grid">
<div class="card"><div class="stat">${reading.items}</div><p>текста для чтения, ${reading.questions} вопроса (A1–C2)</p></div>
<div class="card"><div class="stat">${listening.items}</div><p>сценариев аудирования, ${listening.questions} вопроса; нужна озвучка</p></div>
<div class="card"><div class="stat">${realWords}</div><p>слов по уровням CEFR и ${pool.pseudo.length} псевдослов для проверки словаря</p></div>
<div class="card"><div class="stat">71</div><p>автоматических теста: 40 сквозных, 8 на TypeScript, 23 на Python</p></div>
</div>
<ul>
<li>Пилотное приложение: 60 слов, 10 текстов для чтения, 4 записи для аудирования (когда будут файлы), результат по ссылке, выгрузка данных для калибровки.</li>
<li>Своя реализация модели Раша: калибровка по пилоту, симуляция точности, проверка заданий по профилю лексики CEFR-J.</li>
<li>Лицензии: код MIT, содержимое CC BY-SA 4.0. Источники и условия — в разделе «Методология».</li>
</ul>

<h2>Что ещё не сделано</h2>
<ul>
<li>Нет аудиозаписей (сценарии написаны).</li>
<li>Задания не проверены носителем и не откалиброваны на реальных людях: нужен пилот на 300 человек.</li>
<li>Приложение не развёрнуто, юридические тексты — черновик.</li>
</ul>

<h2>Документы</h2>
<div class="grid">${cards}
<a class="card" style="text-decoration:none;color:inherit" href="pages/design-preview/index.html"><h3>Макет интерфейса</h3><p class="muted">Палитра, экран вопроса, карточка результата.</p></a>
</div>
`;
writeFileSync(path.join(out, "index.html"), shell("Открытый тест английского: ход работ", index, 0));
writeFileSync(path.join(out, ".nojekyll"), "");
console.log("built", { reading, listening, realWords, pseudo: pool.pseudo.length });

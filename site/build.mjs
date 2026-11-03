// Собирает статический сайт для GitHub Pages в корень репозитория:
//   index.html (ru), en/index.html, pages/progress.html, pages/dev.html, pages/*.html (документы), assets/.
// Главная строится тем же рендерером и теми же текстами, что и приложение (app/src/lib/landing*).
// Банк заданий и ключи ответов на сайт не попадают: берутся только числа.
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { renderLanding } from "../app/src/lib/landing-html.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const rd = (p) => readFileSync(path.join(repo, p), "utf8");
const wr = (p, s) => { mkdirSync(path.dirname(path.join(repo, p)), { recursive: true }); writeFileSync(path.join(repo, p), s); };
const landing = JSON.parse(rd("app/src/lib/landing.json"));
const REPO = "https://github.com/logist888/Replica";
// Когда пилот развернут, задайте адрес приложения: PILOT_URL=https://... npm run build, и кнопка станет рабочей.
const PILOT_URL = process.env.PILOT_URL || null;

const DOCS = [
  ["recon", "replica/recon.md", "Разведка EF SET", "Что известно о тесте-образце по публичным страницам и что копировать нельзя."],
  ["architecture", "replica/architecture.md", "Архитектура", "Стек, схема данных, интерфейс программы, контент и калибровка."],
  ["methodology", "replica/methodology.md", "Методология", "Какие открытые источники можно использовать, симуляции, принятые решения."],
  ["design", "replica/design/components.md", "Дизайн-система", "Компоненты теста, состояния и доступность."],
  ["test-plan", "replica/test/test-plan.md", "План тестирования", "Проверки по сценариям: прохождение, результат, выгрузка, аудирование."],
  ["bugs", "replica/test/bugs.md", "Найденные ошибки", "Что нашли, что исправили, что осталось проверить."],
  ["listening-guide", "replica/listening-recording-guide.md", "Руководство по записи аудирования", "Как озвучить 36 сценариев."],
];

mkdirSync(path.join(repo, "assets"), { recursive: true });
wr("assets/tokens.css", rd("replica/design/tokens.css"));
wr("assets/landing.css", rd("app/src/app/landing.css"));
wr("assets/site.css", `
@import "tokens.css";
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--color-text);font:400 17px/1.7 var(--font-sans);-webkit-font-smoothing:antialiased}
a{color:var(--color-accent)}
.doc-top{border-bottom:1px solid var(--color-border);background:#fff;position:sticky;top:0;z-index:5}
.doc-top div{max-width:860px;margin:0 auto;padding:10px 20px;min-height:60px;display:flex;align-items:center;flex-wrap:wrap;gap:6px 20px}
.doc-top strong{margin-right:auto}.doc-top a{text-decoration:none;color:var(--color-text-muted);font-size:15px}
.doc{max-width:860px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:clamp(30px,4vw,40px);line-height:1.15;letter-spacing:-.015em;margin:12px 0 16px}h2{font-size:25px;line-height:1.25;margin:40px 0 10px}h3{font-size:19px;margin:26px 0 6px}
.lede{font-size:20px;color:var(--color-text-muted);margin:0 0 28px}
.muted{color:var(--color-text-muted)}
.notice{background:var(--color-surface);border-left:4px solid var(--color-accent);padding:14px 18px;border-radius:0 12px 12px 0;margin:20px 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:20px 0;padding:0;list-style:none}
.cards li a{display:block;height:100%;border:1px solid var(--color-border);border-radius:16px;padding:18px 20px;text-decoration:none;color:inherit}
.cards li a:hover{border-color:var(--color-accent)}
.cards strong{display:block;font-size:18px}.cards span{color:var(--color-text-muted);font-size:15px;line-height:1.5}
.nums{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin:20px 0;padding:0;list-style:none}
.nums li{border:1px solid var(--color-border);border-radius:16px;padding:16px 18px}.nums b{display:block;font-size:30px;line-height:1.2}.nums span{color:var(--color-text-muted);font-size:15px}
table{border-collapse:collapse;width:100%;font-size:15px;line-height:1.5;display:block;overflow-x:auto}
th,td{border:1px solid var(--color-border);padding:7px 11px;text-align:left;vertical-align:top}th{background:var(--color-surface)}
pre{background:var(--color-surface);padding:14px;border-radius:12px;overflow-x:auto;font-size:13.5px;line-height:1.55}code{font-family:var(--font-mono);font-size:.92em}
blockquote{margin:14px 0;padding:2px 18px;border-left:4px solid var(--color-border)}img{max-width:100%}
`);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const docShell = (title, body, depth) => {
  const up = "../".repeat(depth);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="${up}assets/site.css"></head><body>
<header class="doc-top"><div><strong>Open English Test</strong><a href="${up}index.html">Главная</a><a href="${up}pages/progress.html">Ход работ</a><a href="${up}pages/dev.html">Для разработчиков</a><a href="${REPO}">GitHub</a></div></header>
<main class="doc">${body}</main></body></html>`;
};

// --- числа из репозитория (ключи ответов не читаем) ---
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

// --- документы ---
for (const [slug, file, title] of DOCS) {
  wr(`pages/${slug}.html`, docShell(title, `<p class="muted"><a href="dev.html">← Для разработчиков</a></p>${marked.parse(rd(file))}`, 1));
}
const dp = path.join(repo, "pages/design-preview");
mkdirSync(dp, { recursive: true });
for (const f of ["preview.html", "tokens.css", "tokens.js", "tokens.json"]) cpSync(path.join(repo, "replica/design", f), path.join(dp, f));
cpSync(path.join(dp, "preview.html"), path.join(dp, "index.html"));

wr("pages/dev.html", docShell("Для разработчиков и исследователей", `
<h1>Для разработчиков и исследователей</h1>
<p class="lede">Здесь собраны рабочие документы проекта: как устроен тест, откуда взяты материалы, как мы проверяли программу и что ещё не готово. Читать их не обязательно, чтобы пройти тест.</p>
<ul class="cards">
${DOCS.map(([slug, , title, desc]) => `<li><a href="${slug}.html"><strong>${title}</strong><span>${desc}</span></a></li>`).join("\n")}
<li><a href="design-preview/index.html"><strong>Макет интерфейса</strong><span>Палитра, экран вопроса и карточка результата.</span></a></li>
</ul>
<h2>Исходный код и лицензии</h2>
<p>Весь код и все материалы теста открыты: <a href="${REPO}">${REPO}</a>. Код распространяется по лицензии MIT, тексты и вопросы — по CC BY-SA 4.0.</p>
`, 1));

wr("pages/progress.html", docShell("Ход работ", `
<h1>Ход работ</h1>
<p class="lede">Мы делаем бесплатный открытый тест английского. Здесь коротко: что уже готово, чего не хватает и что будет дальше. Обновлено ${today}.</p>

<h2>Что уже есть</h2>
<ul class="nums">
<li><b>${reading.items}</b><span>текста для проверки чтения, ${reading.questions} вопроса — от A1 до C2</span></li>
<li><b>${listening.items}</b><span>сценариев для аудирования, ${listening.questions} вопроса</span></li>
<li><b>${realWords}</b><span>слов с известным уровнем и ${pool.pseudo.length} выдуманных для проверки словаря</span></li>
<li><b>71</b><span>автоматический тест программы: все проходят</span></li>
</ul>
<p>Готова сама программа пилота: человек отвечает на слова и вопросы к текстам, получает диапазон своего уровня и ссылку на результат. Мы умеем выгружать ответы всех участников и считать по ним, насколько трудным оказался каждый вопрос.</p>

<h2>Чего не хватает</h2>
<ul>
<li><b>Озвученных записей.</b> Сценарии для аудирования написаны, но их ещё никто не прочитал вслух. Пока записей нет, в тесте будут только слова и чтение.</li>
<li><b>Проверки живым носителем английского.</b> Тексты и вопросы писались по строгим правилам и проверялись программами, но человек с хорошим английским их ещё не читал.</li>
<li><b>Пилота на реальных людях.</b> Чтобы честно сказать, где проходит граница между уровнями, нужны ответы примерно 300 человек.</li>
<li><b>Публичного адреса.</b> Программу нужно разместить на сервере. Пока тест нельзя пройти в браузере.</li>
</ul>

<h2>Что будет дальше</h2>
<ol>
<li>Озвучить записи и добавить третью часть теста.</li>
<li>Разместить пилот и позвать первых участников.</li>
<li>По ответам участников уточнить трудность каждого вопроса и границы уровней.</li>
<li>Выпустить обновлённый тест и открыть всю статистику пилота.</li>
</ol>

<div class="notice">Пока тест проходит пилот, его результат — ориентир, а не диагноз. Мы специально показываем диапазон уровня, например B1–B2, а не одну букву.</div>
<p>Подробнее — в <a href="dev.html">документах проекта</a>.</p>
`, 1));

// --- главная (ru) и английская версия ---
const page = (t, other, o) => `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.meta.title)}</title><meta name="description" content="${esc(t.meta.description)}">
<link rel="stylesheet" href="${o.up}assets/tokens.css"><link rel="stylesheet" href="${o.up}assets/landing.css"><style>body{margin:0}</style></head>
<body>${renderLanding(t, o)}</body></html>`;
const common = (lang) => ({
  startHref: PILOT_URL ? `${PILOT_URL.replace(/\/$/, "")}/${lang}` : null,
  followHref: REPO,
  repoHref: REPO,
});
wr("index.html", page(landing.ru, "en", { ...common("ru"), up: "", switchHref: "en/index.html", switchLabel: "English", privacyHref: PILOT_URL ? `${PILOT_URL.replace(/\/$/, "")}/ru/privacy` : "pages/progress.html", devHref: "pages/dev.html", progressHref: "pages/progress.html" }));
wr("en/index.html", page(landing.en, "ru", { ...common("en"), up: "../", switchHref: "../index.html", switchLabel: "Русский", privacyHref: PILOT_URL ? `${PILOT_URL.replace(/\/$/, "")}/en/privacy` : "../pages/progress.html", devHref: "../pages/dev.html", progressHref: "../pages/progress.html" }));
wr(".nojekyll", "");
console.log("built", { reading, listening, realWords, pseudo: pool.pseudo.length, pilot: PILOT_URL });

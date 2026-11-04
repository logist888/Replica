// Единственный источник разметки главной страницы: используется и приложением (Next), и сайтом на Pages.
// Данные берутся из landing.json. Текст экранируется; HTML собирается только здесь.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");

/**
 * @param t  объект одного языка из landing.json
 * @param o  { startHref|null, switchHref, switchLabel, privacyHref, devHref, progressHref, repoHref, followHref }
 */
export function renderLanding(t, o) {
  const keys = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const startBtn = (cls = "") =>
    o.startHref
      ? `<a class="btn solid ${cls}" href="${esc(o.startHref)}">${esc(t.cta.start)}</a>`
      : `<span class="btn soon ${cls}">${esc(t.cta.soon)}</span>`;
  const follow = o.startHref ? "" : `<a class="btn line ${""}" href="${esc(o.followHref)}">${esc(t.cta.follow)}</a>`;

  return `
<div class="lp" lang="${esc(t.lang)}">
<header class="lp-nav">
  <div class="lp-wrap lp-nav-in">
    <a class="lp-brand" href="#top"><span class="lp-mark" aria-hidden="true"></span>${esc(t.brand)}</a>
    <nav aria-label="${esc(t.nav.how)}">
      <a href="#how">${esc(t.nav.how)}</a><a href="#levels">${esc(t.nav.levels)}</a><a href="#open">${esc(t.nav.open)}</a><a href="#faq">${esc(t.nav.faq)}</a>
    </nav>
    <a class="lp-lang" href="${esc(o.switchHref)}" lang="${t.lang === "ru" ? "en" : "ru"}">${esc(o.switchLabel)}</a>
  </div>
</header>

<main id="top">
<section class="lp-hero">
  <div class="lp-wrap">
    <p class="lp-eyebrow">${esc(t.hero.eyebrow)}</p>
    <h1>${esc(t.hero.title)}</h1>
    <div class="lp-hero-row">
      <p class="lp-lead">${esc(t.hero.lead)}</p>
      <div class="lp-hero-act"><div class="lp-actions">${startBtn()}${follow}</div><p class="lp-note">${esc(t.hero.note)}</p></div>
    </div>

    <figure class="lp-spec" aria-label="${esc(t.hero.card.label)}">
      <ol class="lp-spec-row">
        ${t.levels.items.map((l, i) => `<li data-k="${keys[i]}"><b>${esc(l.k)}</b><span>${esc(l.t)}</span></li>`).join("")}
      </ol>
      <figcaption class="lp-spec-mark"><span class="lp-spec-bracket" aria-hidden="true"></span>
        <strong>${esc(t.hero.card.label)}: ${esc(t.hero.card.range)}</strong><em>${esc(t.hero.card.badge)}</em><span class="lp-spec-cap">${esc(t.hero.card.caption)}</span>
      </figcaption>
    </figure>

    <ul class="lp-facts">${t.facts.map((f) => `<li><b>${esc(f.v)}</b><span>${esc(f.t)}</span></li>`).join("")}</ul>
  </div>
</section>

<section class="lp-sec" id="how">
  <div class="lp-wrap lp-split">
    <div class="lp-side"><h2>${esc(t.steps.title)}</h2><p class="lp-sub">${esc(t.steps.lead)}</p></div>
    <ol class="lp-rows">${t.steps.items.map((s, i) => `<li><span class="lp-n">${pad(i + 1)}</span><div><h3>${esc(s.t)} <small>${esc(s.time)}</small></h3><p>${esc(s.d)}</p></div></li>`).join("")}</ol>
  </div>
</section>

<section class="lp-sec lp-sand" id="levels">
  <div class="lp-wrap lp-split">
    <div class="lp-side"><h2>${esc(t.levels.title)}</h2><p class="lp-sub">${esc(t.levels.lead)}</p></div>
    <ul class="lp-lv">${t.levels.items.map((l, i) => `<li><span class="lp-lvk" data-k="${keys[i]}">${esc(l.k)}</span><div><h3>${esc(l.t)}</h3><p>${esc(l.d)}</p></div></li>`).join("")}</ul>
  </div>
</section>

<section class="lp-sec lp-dark" id="open">
  <div class="lp-wrap">
    <h2>${esc(t.open.title)}</h2><p class="lp-sub">${esc(t.open.lead)}</p>
    <ol class="lp-big">${t.open.items.map((i, k) => `<li><span class="lp-n">${pad(k + 1)}</span><h3>${esc(i.t)}</h3><p>${esc(i.d)}</p></li>`).join("")}</ol>
  </div>
</section>

<section class="lp-sec">
  <div class="lp-wrap lp-two">
    <div><h2>${esc(t.measure.title)}</h2>${t.measure.p.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    <div><h2>${esc(t.privacy.title)}</h2>${t.privacy.p.map((p) => `<p>${esc(p)}</p>`).join("")}<p><a class="lp-link" href="${esc(o.privacyHref)}">${esc(t.privacy.link)}</a></p></div>
  </div>
</section>

<section class="lp-sec lp-sand" id="faq">
  <div class="lp-wrap lp-split">
    <div class="lp-side"><h2>${esc(t.faq.title)}</h2></div>
    <div class="lp-faq">${t.faq.items.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
  </div>
</section>

<section class="lp-cta">
  <div class="lp-wrap lp-cta-in">
    <h2>${esc(t.help.title)}</h2>
    <div><p>${esc(t.help.text)}</p><div class="lp-actions">${startBtn("dark")}</div></div>
  </div>
</section>
</main>

<footer class="lp-foot">
  <div class="lp-wrap lp-foot-in">
    <div><strong>${esc(t.brand)}</strong><p>${esc(t.footer.pilot)}</p><p>${esc(t.footer.license)}</p></div>
    <ul>
      <li><a href="${esc(o.repoHref)}">${esc(t.footer.source)}</a></li>
      <li><a href="${esc(o.progressHref)}">${esc(t.help.progress)}</a></li>
      <li><a href="${esc(o.devHref)}">${esc(t.help.dev)}</a></li>
    </ul>
  </div>
</footer>
</div>`;
}

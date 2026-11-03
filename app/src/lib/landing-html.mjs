// Единственный источник разметки главной страницы: используется и приложением (Next), и сайтом на Pages.
// Данные берутся из landing.json. Текст экранируется; HTML собирается только здесь.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * @param t  объект одного языка из landing.json
 * @param o  { startHref|null, switchHref, switchLabel, privacyHref, devHref, progressHref, repoHref, followHref }
 */
export function renderLanding(t, o) {
  const scale = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const startBtn = (cls = "") =>
    o.startHref
      ? `<a class="btn primary ${cls}" href="${esc(o.startHref)}">${esc(t.cta.start)}</a>`
      : `<span class="btn primary disabled ${cls}" aria-disabled="true">${esc(t.cta.soon)}</span>`;
  const follow = o.startHref ? "" : `<a class="btn ghost" href="${esc(o.followHref)}">${esc(t.cta.follow)}</a>`;

  return `
<div class="lp" lang="${esc(t.lang)}">
<header class="lp-nav">
  <div class="lp-wrap lp-nav-in">
    <a class="lp-brand" href="#top"><span class="lp-logo" aria-hidden="true"></span>${esc(t.brand)}</a>
    <nav aria-label="${esc(t.nav.how)}">
      <a href="#how">${esc(t.nav.how)}</a><a href="#levels">${esc(t.nav.levels)}</a><a href="#open">${esc(t.nav.open)}</a><a href="#faq">${esc(t.nav.faq)}</a>
    </nav>
    <a class="lp-lang" href="${esc(o.switchHref)}" lang="${t.lang === "ru" ? "en" : "ru"}">${esc(o.switchLabel)}</a>
  </div>
</header>

<main id="top">
<section class="lp-hero">
  <div class="lp-wrap lp-hero-in">
    <div class="lp-hero-text">
      <p class="lp-eyebrow">${esc(t.hero.eyebrow)}</p>
      <h1>${esc(t.hero.title)}</h1>
      <p class="lp-lead">${esc(t.hero.lead)}</p>
      <div class="lp-actions">${startBtn()}${follow}</div>
      <p class="lp-note">${esc(t.hero.note)}</p>
    </div>
    <figure class="lp-result" aria-label="${esc(t.hero.card.label)}">
      <figcaption>${esc(t.hero.card.label)}</figcaption>
      <div class="lp-result-card">
        <div class="lp-result-top"><span>${esc(t.hero.card.skill)}</span><span class="lp-pill">${esc(t.hero.card.badge)}</span></div>
        <div class="lp-score">${esc(t.hero.card.range)}</div>
        <div class="lp-scale" role="img" aria-label="A1, A2, B1, B2, C1, C2">
          ${scale.map((k) => `<span>${k}</span>`).join("")}<i class="lp-range" aria-hidden="true"></i>
        </div>
        <p>${esc(t.hero.card.caption)}</p>
      </div>
    </figure>
  </div>
  <div class="lp-wrap"><ul class="lp-facts">${t.facts.map((f) => `<li><b>${esc(f.v)}</b><span>${esc(f.t)}</span></li>`).join("")}</ul></div>
</section>

<section class="lp-sec" id="how">
  <div class="lp-wrap">
    <h2>${esc(t.steps.title)}</h2><p class="lp-sub">${esc(t.steps.lead)}</p>
    <ol class="lp-steps">${t.steps.items.map((s) => `<li><span class="lp-num">${esc(s.n)}</span><h3>${esc(s.t)}</h3><p class="lp-time">${esc(s.time)}</p><p>${esc(s.d)}</p></li>`).join("")}</ol>
  </div>
</section>

<section class="lp-sec lp-alt" id="levels">
  <div class="lp-wrap">
    <h2>${esc(t.levels.title)}</h2><p class="lp-sub">${esc(t.levels.lead)}</p>
    <ul class="lp-levels">${t.levels.items.map((l) => `<li><span class="lp-lv">${esc(l.k)}</span><div><h3>${esc(l.t)}</h3><p>${esc(l.d)}</p></div></li>`).join("")}</ul>
  </div>
</section>

<section class="lp-sec" id="open">
  <div class="lp-wrap">
    <h2>${esc(t.open.title)}</h2><p class="lp-sub">${esc(t.open.lead)}</p>
    <ul class="lp-cards">${t.open.items.map((i) => `<li><h3>${esc(i.t)}</h3><p>${esc(i.d)}</p></li>`).join("")}</ul>
  </div>
</section>

<section class="lp-sec lp-alt">
  <div class="lp-wrap lp-two">
    <div><h2>${esc(t.measure.title)}</h2>${t.measure.p.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    <div><h2>${esc(t.privacy.title)}</h2>${t.privacy.p.map((p) => `<p>${esc(p)}</p>`).join("")}<p><a href="${esc(o.privacyHref)}">${esc(t.privacy.link)}</a></p></div>
  </div>
</section>

<section class="lp-sec" id="faq">
  <div class="lp-wrap lp-narrow">
    <h2>${esc(t.faq.title)}</h2>
    <div class="lp-faq">${t.faq.items.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
  </div>
</section>

<section class="lp-cta">
  <div class="lp-wrap lp-cta-in">
    <div><h2>${esc(t.help.title)}</h2><p>${esc(t.help.text)}</p></div>
    <div class="lp-actions">${startBtn("on-dark")}</div>
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

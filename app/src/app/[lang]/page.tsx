import Link from "next/link";
import { notFound } from "next/navigation";
import { copy, LANGS, type Lang } from "@/lib/copy";

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  const t = copy[lang as Lang];
  const other = lang === "ru" ? "en" : "ru";
  return (
    <main className="wrap stack" lang={lang}>
      <div className="row between lang">
        <strong>English level pilot</strong>
        <Link href={`/${other}`} hrefLang={other} lang={other}>{other === "ru" ? "Русский" : "English"}</Link>
      </div>
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      <h2>{t.what}</h2>
      <ul>{t.items.map((x) => <li key={x}>{x}</li>)}</ul>
      <h2>{t.rules}</h2>
      <ul>{t.rulesItems.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="alert">{t.notOfficial}</p>
      <div className="row">
        <Link className="btn primary" href="/test">{t.start}</Link>
        <Link href={`/${lang}/privacy`}>{t.privacy}</Link>
      </div>
    </main>
  );
}

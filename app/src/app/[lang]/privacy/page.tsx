import Link from "next/link";
import { notFound } from "next/navigation";
import { LANGS, type Lang } from "@/lib/copy";
import privacy from "@/lib/privacy.json";

export default async function Privacy({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  const t = privacy[lang as Lang];
  return (
    <main className="wrap stack" lang={lang}>
      <h1>{t.h}</h1>
      <p style={{ fontSize: 18 }}>{t.intro}</p>
      {t.sections.map((s) => (
        <section key={s.t}>
          <h2>{s.t}</h2>
          {s.p.map((x) => <p key={x}>{x}</p>)}
        </section>
      ))}
      <p className="muted small">{t.note}</p>
      <Link href={`/${lang}`}>{t.back}</Link>
    </main>
  );
}

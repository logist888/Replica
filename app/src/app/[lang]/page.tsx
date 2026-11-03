import { notFound } from "next/navigation";
import landing from "@/lib/landing.json";
import { renderLanding } from "@/lib/landing-html.mjs";
import { LANGS, type Lang } from "@/lib/copy";
import "../landing.css";

const REPO = "https://github.com/logist888/Replica";
const DOCS = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://logist888.github.io/Replica";

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const t = (landing as any)[lang];
  return t ? { title: t.meta.title, description: t.meta.description, robots: { index: false, follow: false } } : {};
}

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  const other = lang === "ru" ? "en" : "ru";
  const html = renderLanding((landing as any)[lang], {
    startHref: "/test",
    switchHref: `/${other}`,
    switchLabel: other === "ru" ? "Русский" : "English",
    privacyHref: `/${lang}/privacy`,
    devHref: `${DOCS}/pages/dev.html`,
    progressHref: `${DOCS}/pages/progress.html`,
    repoHref: REPO,
    followHref: REPO,
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

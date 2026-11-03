import Link from "next/link";

export default function Home() {
  return (
    <main className="wrap stack">
      <h1>English level pilot</h1>
      <p className="muted">Choose a language / Выберите язык</p>
      <div className="row">
        <Link className="btn primary" href="/ru">Русский</Link>
        <Link className="btn secondary" href="/en">English</Link>
      </div>
    </main>
  );
}

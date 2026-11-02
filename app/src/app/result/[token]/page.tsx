import { notFound } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { TOKEN_RE } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function Result({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  const r = await pool().query("select results, status from sessions where token=$1", [token]);
  const row = r.rows[0];
  if (!row || row.status !== "done" || !row.results) notFound();
  const { vocab, reading, answered, listening } = row.results;
  const range = reading.low === reading.high ? reading.low : `${reading.low}–${reading.high}`;
  return (
    <main className="wrap stack">
      <h1>Your pilot result</h1>
      <p className="alert">Provisional estimate. This is a pilot test: the questions are still being calibrated, so the range may change. It is not an official certificate.</p>
      <section className="card stack" aria-labelledby="rd">
        <h2 id="rd" style={{ margin: 0 }}>Reading</h2>
        <p className="score">{range}</p>
        <p className="muted">Estimated CEFR range, based on {answered} questions. Most likely level: <span className="badge">{reading.level}</span></p>
      </section>
      {listening && (
        <section className="card stack" aria-labelledby="ls">
          <h2 id="ls" style={{ margin: 0 }}>Listening</h2>
          <p className="score">{listening.low === listening.high ? listening.low : `${listening.low}–${listening.high}`}</p>
          <p className="muted">Estimated CEFR range, based on {listening.answered} questions. Most likely level: <span className="badge">{listening.level}</span></p>
        </section>
      )}
      <section className="card stack" aria-labelledby="vc">
        <h2 id="vc" style={{ margin: 0 }}>Vocabulary</h2>
        {vocab.valid ? (
          vocab.provisionalLevel ? (
            <p>Words known up to level <span className="badge">{vocab.provisionalLevel}</span> (provisional rule).</p>
          ) : (
            <p>You knew too few of the words to place your vocabulary at A1 on this test (provisional rule).</p>
          )
        ) : (
          <p>We could not estimate your vocabulary level: too many of the made-up words were marked as known. This does not affect the reading result.</p>
        )}
      </section>
      <p>Thank you for taking part. Your answers help us build an open and free English test.</p>
      <p className="muted small">Result code: {token.slice(-8)}. Keep this link private if you do not want others to see your result.</p>
      <div><Link href="/en">Back to the start</Link></div>
    </main>
  );
}

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { loadSession } from "@/lib/session";
import { readingBank } from "@/lib/content";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const s = await loadSession(body?.token);
  if (!s) return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
  if (s.status !== "reading") return NextResponse.json({ error: "Reading part is not active." }, { status: 409 });
  const allowed = new Set<string>(s.form.reading ?? []);
  const bank = new Map(readingBank().filter((p) => allowed.has(p.id)).map((p) => [p.id, p]));
  const list = body?.answers;
  if (!Array.isArray(list) || list.length === 0 || list.length > 10) return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  const rows: Array<[string, number, boolean, number | null]> = [];
  for (const a of list) {
    const q = [...bank.values()].flatMap((p) => p.questions).find((x) => x.id === a?.id);
    if (!q) return NextResponse.json({ error: "Unknown question" }, { status: 400 });
    if (!Number.isInteger(a.choice) || a.choice < 0 || a.choice > 3) return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
    const ms = Number.isInteger(a.timeMs) && a.timeMs >= 0 ? Math.min(a.timeMs, 3_600_000) : null;
    rows.push([q.id, a.choice, a.choice === q.answer, ms]);
  }
  const c = await pool().connect();
  try {
    await c.query("begin");
    for (const [id, choice, ok, ms] of rows) {
      await c.query(
        `insert into responses (session_id, part, item_id, answer, is_correct, time_ms) values ($1,'reading',$2,$3,$4,$5)
         on conflict do nothing`,
        [s.id, id, String(choice), ok, ms],
      );
    }
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
  return NextResponse.json({ ok: true });
}

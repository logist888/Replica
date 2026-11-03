import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { loadSession } from "@/lib/session";
import { listeningBank, readingBank } from "@/lib/content";
import { pickScripts } from "@/lib/form";
import { LEVELS, readingEstimate, type Level } from "@/lib/scoring";

// Переход reading -> listening. Если записей нет, часть 3 пропускается ({ skip: true }).
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const s = await loadSession(body?.token);
  if (!s) return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
  if (s.status === "listening") {
    // повторный вызов: отдать тот же набор
    const bank = new Map(listeningBank().map((x) => [x.id, x]));
    const ids: string[] = s.form.listening ?? [];
    return NextResponse.json({ items: ids.map((id) => bank.get(id)).filter(Boolean).map((p) => view(p!)) });
  }
  if (s.status !== "reading") return NextResponse.json({ error: "Reading part is not finished." }, { status: 409 });
  const answered = await pool().query("select count(*)::int n from responses where session_id=$1 and part='reading'", [s.id]);
  if (answered.rows[0].n < 12) return NextResponse.json({ error: "Please answer the reading questions first." }, { status: 409 });

  const bank = listeningBank();
  if (bank.length === 0) return NextResponse.json({ skip: true });
  const levelOf = new Map<string, Level>();
  for (const p of readingBank()) for (const q of p.questions) levelOf.set(q.id, p.level);
  const rr = await pool().query("select item_id, is_correct from responses where session_id=$1 and part='reading'", [s.id]);
  const est = readingEstimate(rr.rows.filter((x) => levelOf.has(x.item_id)).map((x) => ({ level: levelOf.get(x.item_id)!, correct: x.is_correct as boolean })));
  const center = Math.max(0, LEVELS.indexOf(est.level));
  const chosen = pickScripts(bank, center);
  const form = { ...s.form, listening: chosen.map((p) => p.id) };
  const moved = await pool().query("update sessions set status='listening', form=$2 where id=$1 and status='reading'", [s.id, JSON.stringify(form)]);
  if (moved.rowCount !== 1) return NextResponse.json({ error: "Already started." }, { status: 409 });
  return NextResponse.json({ items: chosen.map(view) });
}

function view(p: { id: string; title: string; plays: number; questions: { id: string; stem: string; options: string[] }[] }) {
  return { id: p.id, title: p.title, plays: p.plays, questions: p.questions.map((q) => ({ id: q.id, stem: q.stem, options: q.options })) };
}

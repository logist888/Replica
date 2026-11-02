import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { loadSession } from "@/lib/session";
import { readingBank } from "@/lib/content";
import { pickPassages } from "@/lib/form";
import { LEVELS, vocabScore, type VocabItem } from "@/lib/scoring";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const s = await loadSession(body?.token);
  if (!s) return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
  if (s.status !== "vocab") return NextResponse.json({ error: "Part 1 is already submitted." }, { status: 409 });

  const items: VocabItem[] = s.form.vocab;
  const said: Record<string, boolean> = {};
  const answers = body?.answers;
  if (typeof answers !== "object" || answers === null) return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  for (const it of items) {
    if (typeof answers[it.word] !== "boolean") return NextResponse.json({ error: "All words must be answered." }, { status: 400 });
    said[it.word] = answers[it.word];
  }
  const totalMs = Number.isInteger(body?.timeMs) && body.timeMs >= 0 ? Math.min(body.timeMs, 3_600_000) : null;
  const score = vocabScore(items, said);
  const bank = readingBank();
  const center = score.valid && score.provisionalLevel ? LEVELS.indexOf(score.provisionalLevel) : null;
  const passages = pickPassages(bank, center);

  const c = await pool().connect();
  try {
    await c.query("begin");
    // Атомарный переход vocab -> reading: из параллельных запросов выигрывает один, остальные получают 409.
    const form = { ...s.form, vocabScore: score, reading: passages.map((p) => p.id) };
    const moved = await c.query("update sessions set status='reading', form=$2 where id=$1 and status='vocab'", [s.id, JSON.stringify(form)]);
    if (moved.rowCount !== 1) {
      await c.query("rollback");
      return NextResponse.json({ error: "Part 1 is already submitted." }, { status: 409 });
    }
    for (const it of items) {
      await c.query(
        `insert into responses (session_id, part, item_id, answer, is_correct, time_ms) values ($1,'vocab',$2,$3,$4,$5)
         on conflict do nothing`,
        [s.id, "V:" + it.word, said[it.word] ? "yes" : "no", said[it.word] === it.real, totalMs === null ? null : Math.round(totalMs / items.length)],
      );
    }
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
  return NextResponse.json({
    passages: passages.map((p) => ({
      id: p.id, title: p.title, text: p.text,
      questions: p.questions.map((q) => ({ id: q.id, stem: q.stem, options: q.options })),
    })),
  });
}

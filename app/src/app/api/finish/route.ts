import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { loadSession } from "@/lib/session";
import { listeningBank, readingBank } from "@/lib/content";
import { readingEstimate, type Level } from "@/lib/scoring";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const s = await loadSession(body?.token);
  if (!s) return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
  if (s.status === "done") return NextResponse.json({ url: "/result/" + s.token });
  if (s.status === "vocab") return NextResponse.json({ error: "Finish the vocabulary part first." }, { status: 409 });
  // Из reading можно завершить только если аудирование недоступно; иначе клиент обязан пройти часть 3.
  if (s.status === "reading" && listeningBank().length > 0) {
    return NextResponse.json({ error: "Please continue to the listening part." }, { status: 409 });
  }

  const levelOf = new Map<string, Level>();
  for (const p of readingBank()) for (const q of p.questions) levelOf.set(q.id, p.level);
  const r = await pool().query("select item_id, is_correct from responses where session_id=$1 and part='reading'", [s.id]);
  const items = r.rows.filter((x) => levelOf.has(x.item_id)).map((x) => ({ level: levelOf.get(x.item_id)!, correct: x.is_correct as boolean }));
  const asked = (s.form.reading ?? []).length * 3;
  if (items.length < Math.min(asked, 12)) return NextResponse.json({ error: "Please answer the reading questions first." }, { status: 409 });
  const reading = readingEstimate(items);
  const results: any = { vocab: s.form.vocabScore, reading, answered: items.length, version: "pilot-0" };

  if (s.status === "listening") {
    const lvl = new Map<string, Level>();
    for (const p of listeningBank()) for (const q of p.questions) lvl.set(q.id, p.level);
    const lr = await pool().query("select item_id, is_correct from responses where session_id=$1 and part='listening'", [s.id]);
    const li = lr.rows.filter((x) => lvl.has(x.item_id)).map((x) => ({ level: lvl.get(x.item_id)!, correct: x.is_correct as boolean }));
    const lasked = (s.form.listening ?? []).length * 3;
    if (li.length < Math.min(lasked, 6)) return NextResponse.json({ error: "Please answer the listening questions first." }, { status: 409 });
    results.listening = { ...readingEstimate(li), answered: li.length };
  }
  // Условное обновление: параллельный повторный вызов не перезапишет уже сохранённый результат.
  await pool().query("update sessions set status='done', results=$2, finished_at=now() where id=$1 and status in ('reading','listening')", [s.id, JSON.stringify(results)]);
  return NextResponse.json({ url: "/result/" + s.token });
}

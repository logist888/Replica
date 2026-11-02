import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";

function csv(rows: any[], cols: string[]): string {
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    if (/^([=+@\t\r]|-(?![\d.]))/.test(s) && !/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) s = "'" + s; // защита от формул; числа не трогаем
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

export async function GET(req: Request) {
  const want = process.env.ADMIN_TOKEN;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!want || want.length < 16 || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind === "responses") {
    const r = await pool().query(
      `select s.id as session_id, r.part, r.item_id, r.answer, r.is_correct::int as correct, r.time_ms, r.answered_at
       from responses r join sessions s on s.id = r.session_id where s.status = 'done' order by r.id`,
    );
    return new NextResponse(csv(r.rows, ["session_id", "part", "item_id", "answer", "correct", "time_ms", "answered_at"]), { headers: { "content-type": "text/csv" } });
  }
  if (kind === "sessions") {
    const r = await pool().query(
      `select s.id as session_id, s.started_at, s.finished_at, p.cookie_id, p.native_language, p.years_learning, p.self_level, p.ext_test, p.ext_score,
              s.results->'vocab'->>'provisionalLevel' as vocab_level, s.results->'reading'->>'level' as reading_level, s.results->'reading'->>'theta' as reading_theta
       from sessions s join participants p on p.id = s.participant_id where s.status = 'done' order by s.started_at`,
    );
    return new NextResponse(csv(r.rows, ["session_id", "started_at", "finished_at", "cookie_id", "native_language", "years_learning", "self_level", "ext_test", "ext_score", "vocab_level", "reading_level", "reading_theta"]), { headers: { "content-type": "text/csv" } });
  }
  return new NextResponse("Not found", { status: 404 });
}

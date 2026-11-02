import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { pool } from "@/lib/db";
import { token, } from "@/lib/rng";
import { buildVocabForm } from "@/lib/form";
import { vocabPool } from "@/lib/content";
import { rateLimited } from "@/lib/session";

const SELF = new Set(["A1", "A2", "B1", "B2", "C1", "C2", "unknown"]);
const EXT = new Set(["ielts", "toefl", "cambridge", "duolingo", "toeic", "other"]);

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export async function POST(req: Request) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (rateLimited("start:" + ip, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (body?.consent !== true || body?.age16 !== true) {
    return NextResponse.json({ error: "Consent and age confirmation are required." }, { status: 400 });
  }
  const b = body.background ?? {};
  const years = Number.isInteger(b.yearsLearning) && b.yearsLearning >= 0 && b.yearsLearning <= 80 ? b.yearsLearning : null;
  const selfLevel = SELF.has(b.selfLevel) ? b.selfLevel : null;
  const ext = EXT.has(b.extTest) ? b.extTest : null;
  const extScore = ext ? clean(b.extScore, 20) : null;
  const jar = await cookies();
  let cookieId = jar.get("pid")?.value;
  if (!cookieId || !/^[0-9a-f]{32}$/.test(cookieId)) cookieId = token();

  const form = buildVocabForm(vocabPool());
  const tok = token();
  const c = await pool().connect();
  try {
    await c.query("begin");
    const p = await c.query(
      `insert into participants (cookie_id, age_confirmed_16, native_language, years_learning, self_level, ext_test, ext_score)
       values ($1,true,$2,$3,$4,$5,$6) returning id`,
      [cookieId, clean(b.nativeLanguage, 40), years, selfLevel, ext, extScore],
    );
    await c.query(
      "insert into sessions (token, participant_id, form, user_agent) values ($1,$2,$3,$4)",
      [tok, p.rows[0].id, JSON.stringify({ vocab: form }), (h.get("user-agent") ?? "").slice(0, 200)],
    );
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
  const res = NextResponse.json({ token: tok, vocab: form.map((i) => i.word) });
  res.cookies.set("pid", cookieId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}

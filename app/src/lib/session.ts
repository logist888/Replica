import { pool } from "./db";

export const TOKEN_RE = /^[0-9a-f]{32}$/;
export const MAX_SESSION_MS = 3 * 60 * 60 * 1000;

export type SessionRow = {
  id: string;
  token: string;
  status: "vocab" | "reading" | "listening" | "done";
  form: any;
  results: any;
  started_at: Date;
};

export async function loadSession(token: unknown): Promise<SessionRow | null> {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const r = await pool().query("select id, token, status, form, results, started_at from sessions where token = $1", [token]);
  const s = r.rows[0] as SessionRow | undefined;
  if (!s) return null;
  if (Date.now() - new Date(s.started_at).getTime() > MAX_SESSION_MS) return null;
  return s;
}

// Простейшее ограничение частоты в памяти процесса. На нескольких инстансах его заменить общим хранилищем.
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

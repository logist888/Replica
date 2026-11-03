import { NextResponse } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { loadSession } from "@/lib/session";
import { audioFile } from "@/lib/content";

// Отдаёт аудио только участнику активной сессии и только сценарии из его формы. Поддерживает Range (нужно Safari).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const s = await loadSession(url.searchParams.get("token"));
  const notFound = () => new NextResponse("Not found", { status: 404 });
  if (!s || s.status !== "listening" || !(s.form.listening ?? []).includes(id)) return notFound();
  const a = audioFile(id);
  if (!a) return notFound();
  const size = statSync(a.file).size;
  const headers: Record<string, string> = {
    "content-type": a.type,
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
    "content-disposition": "inline",
    "x-content-type-options": "nosniff",
  };
  const range = req.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m || (m[1] === "" && m[2] === "")) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(end, Number(m[2]));
    }
    if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    status = 206;
    headers["content-range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["content-length"] = String(end - start + 1);
  const stream = Readable.toWeb(createReadStream(a.file, { start, end })) as ReadableStream;
  return new NextResponse(stream, { status, headers });
}

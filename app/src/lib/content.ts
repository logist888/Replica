import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { LEVELS, type Level } from "./scoring";

export type Question = { id: string; type: string; stem: string; options: string[]; answer: number };
export type Passage = { id: string; level: Level; genre?: string; title: string; text: string; questions: Question[] };
export type VocabPool = { real: Record<Level, string[]>; pseudo: string[] };

const root = () => path.join(process.cwd(), "content");

let readingCache: Passage[] | null = null;
let vocabCache: VocabPool | null = null;

export function validatePassages(list: unknown): Passage[] {
  if (!Array.isArray(list)) throw new Error("reading file must be an array");
  const ids = new Set<string>();
  for (const p of list as Passage[]) {
    if (!p.id || !LEVELS.includes(p.level) || !p.text || !Array.isArray(p.questions) || p.questions.length === 0) {
      throw new Error(`bad passage: ${p?.id}`);
    }
    for (const q of p.questions) {
      if (!q.id || ids.has(q.id)) throw new Error(`duplicate or empty question id: ${q?.id}`);
      ids.add(q.id);
      if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error(`question ${q.id} must have 4 options`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) throw new Error(`question ${q.id} has a bad answer index`);
    }
  }
  return list as Passage[];
}

export function readingBank(): Passage[] {
  if (readingCache) return readingCache;
  const dir = path.join(root(), "reading");
  if (!existsSync(dir)) throw new Error("content/reading is missing");
  const all: Passage[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    all.push(...validatePassages(JSON.parse(readFileSync(path.join(dir, f), "utf8"))));
  }
  const ids = new Set<string>();
  for (const p of all) {
    if (ids.has(p.id)) throw new Error(`duplicate passage id ${p.id}`);
    ids.add(p.id);
  }
  readingCache = all;
  return all;
}

export function vocabPool(): VocabPool {
  if (vocabCache) return vocabCache;
  const j = JSON.parse(readFileSync(path.join(root(), "vocab", "pool.json"), "utf8"));
  vocabCache = { real: j.real, pseudo: j.pseudo };
  return vocabCache;
}

// ---------- аудирование ----------
export type ListeningScript = {
  id: string; level: Level; title: string; plays: number; transcript: string; questions: Question[];
};
const AUDIO_EXT = [".mp3", ".m4a", ".ogg", ".webm", ".wav"];
export const AUDIO_TYPES: Record<string, string> = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".webm": "audio/webm", ".wav": "audio/wav" };

export function validateListening(list: unknown): ListeningScript[] {
  if (!Array.isArray(list)) throw new Error("listening file must be an array");
  const ids = new Set<string>();
  for (const p of list as ListeningScript[]) {
    if (!p.id || !LEVELS.includes(p.level) || !p.transcript || !Array.isArray(p.questions) || p.questions.length === 0) {
      throw new Error(`bad listening script: ${p?.id}`);
    }
    if (!Number.isInteger(p.plays) || p.plays < 1 || p.plays > 3) throw new Error(`script ${p.id} has bad plays`);
    for (const q of p.questions) {
      if (!q.id || ids.has(q.id)) throw new Error(`duplicate or empty question id: ${q?.id}`);
      ids.add(q.id);
      if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error(`question ${q.id} must have 4 options`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) throw new Error(`question ${q.id} has a bad answer index`);
    }
  }
  return list as ListeningScript[];
}

export function audioFile(id: string): { file: string; type: string } | null {
  if (!/^L-[A-C][12]-\d{2}$/.test(id)) return null;
  for (const ext of AUDIO_EXT) {
    const f = path.join(root(), "audio", id + ext);
    if (existsSync(f)) return { file: f, type: AUDIO_TYPES[ext] };
  }
  return null;
}

let listeningCache: ListeningScript[] | null = null;
// Только сценарии, для которых есть аудиофайл. Нет записей: часть 3 в тесте не включается.
export function listeningBank(): ListeningScript[] {
  if (listeningCache) return listeningCache;
  const dir = path.join(root(), "listening");
  const all: ListeningScript[] = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
      all.push(...validateListening(JSON.parse(readFileSync(path.join(dir, f), "utf8"))));
    }
  }
  listeningCache = all.filter((s) => audioFile(s.id) !== null);
  return listeningCache;
}

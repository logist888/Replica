"use client";

import { useEffect, useRef, useState } from "react";

type Passage = { id: string; title: string; text: string; questions: { id: string; stem: string; options: string[] }[] };
type Step = "intro" | "vocab" | "reading" | "listening" | "finishing" | "error";
type Clip = { id: string; title: string; plays: number; questions: { id: string; stem: string; options: string[] }[] };

const SELF = ["unknown", "A1", "A2", "B1", "B2", "C1", "C2"];

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong");
  return j;
}


function AudioPlayer({ src, plays, onFinished }: { src: string; plays: number; onFinished?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [left, setLeft] = useState(plays);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pos, setPos] = useState(0);
  return (
    <div className="audio" role="group" aria-label="Audio player">
      <audio
        ref={ref}
        src={src}
        preload="auto"
        onEnded={() => { setPlaying(false); setLeft((n) => n - 1); setPos(0); onFinished?.(); }}
        onError={() => { setFailed(true); setPlaying(false); }}
        onTimeUpdate={(e) => { const a = e.currentTarget; setPos(a.duration ? a.currentTime / a.duration : 0); }}
      />
      <button
        type="button"
        className="play"
        disabled={playing || left <= 0 || failed}
        aria-label={playing ? "Playing" : left > 0 ? "Play audio" : "No plays left"}
        onClick={() => { setPlaying(true); ref.current?.play().catch(() => { setFailed(true); setPlaying(false); }); }}
      >{playing ? "…" : "\u25B6"}</button>
      <div className="track" aria-hidden="true"><b style={{ width: Math.round(pos * 100) + "%" }} /></div>
      <span className="muted small" aria-live="polite">{failed ? "Audio could not be loaded" : `Plays left: ${Math.max(left, 0)}`}</span>
    </div>
  );
}

export default function TestPage() {
  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [ci, setCi] = useState(0);

  // intro
  const [consent, setConsent] = useState(false);
  const [age, setAge] = useState(false);
  const [native, setNative] = useState("");
  const [years, setYears] = useState("");
  const [selfLevel, setSelfLevel] = useState("");
  const [extTest, setExtTest] = useState("");
  const [extScore, setExtScore] = useState("");

  // vocab
  const [vi, setVi] = useState(0);
  const said = useRef<Record<string, boolean>>({});
  const vStart = useRef(0);

  // reading
  const [pi, setPi] = useState(0);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const shownAt = useRef(0);
  const picked = useRef<Record<string, number>>({});

  useEffect(() => {
    if (step === "reading" || step === "listening") {
      shownAt.current = Date.now();
      window.scrollTo(0, 0);
    }
  }, [step, pi, ci]);

  useEffect(() => {
    if (step === "vocab" || step === "reading" || step === "listening") {
      const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
      window.addEventListener("beforeunload", h);
      return () => window.removeEventListener("beforeunload", h);
    }
  }, [step]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const y = years.trim() === "" ? null : Number(years);
      const j = await post("/api/start", {
        consent: true,
        age16: true,
        background: {
          nativeLanguage: native || null,
          yearsLearning: Number.isInteger(y) ? y : null,
          selfLevel: selfLevel || null,
          extTest: extTest || null,
          extScore: extTest ? extScore : null,
        },
      });
      setToken(j.token);
      setWords(j.vocab);
      vStart.current = Date.now();
      setStep("vocab");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function answerWord(yes: boolean) {
    said.current[words[vi]] = yes;
    if (vi + 1 < words.length) {
      setVi(vi + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const j = await post("/api/vocab", { token, answers: said.current, timeMs: Date.now() - vStart.current });
      setPassages(j.passages);
      setPi(0);
      setStep("reading");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function choose(qid: string, k: number) {
    setChoices((c) => ({ ...c, [qid]: k }));
    picked.current[qid] = Date.now() - shownAt.current;
  }

  async function nextPassage() {
    const p = passages[pi];
    setBusy(true);
    setError(null);
    try {
      await post("/api/reading", {
        token,
        answers: p.questions.map((q) => ({ id: q.id, choice: choices[q.id], timeMs: picked.current[q.id] ?? null })),
      });
      if (pi + 1 < passages.length) {
        setPi(pi + 1);
      } else {
        const l = await post("/api/listening/start", { token });
        if (l.skip) {
          setStep("finishing");
          const j = await post("/api/finish", { token });
          window.location.href = j.url;
        } else {
          setClips(l.items);
          setCi(0);
          setStep("listening");
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function nextClip() {
    const c = clips[ci];
    setBusy(true);
    setError(null);
    try {
      await post("/api/listening", {
        token,
        answers: c.questions.map((q) => ({ id: q.id, choice: choices[q.id], timeMs: picked.current[q.id] ?? null })),
      });
      if (ci + 1 < clips.length) {
        setCi(ci + 1);
      } else {
        setStep("finishing");
        const j = await post("/api/finish", { token });
        window.location.href = j.url;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canStart = consent && age && !busy;

  if (step === "intro") {
    return (
      <main className="wrap stack">
        <h1>Before you start</h1>
        <p>This is a pilot of an open English placement test. Results are provisional. The test takes about 30 minutes. Please do not use dictionaries, translators or other help.</p>
        <div className="card stack">
          <label className="check"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /><span>I am at least 16 years old.</span></label>
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I agree that my answers and the optional details below are stored to calibrate the test, as described in the <a href="/en/privacy" target="_blank" rel="noreferrer">privacy notice</a>.</span></label>
        </div>
        <fieldset className="card stack">
          <legend>Optional details (they help calibrate the test)</legend>
          <label className="field">Native language<input type="text" maxLength={40} value={native} onChange={(e) => setNative(e.target.value)} /></label>
          <label className="field">Years of studying English<input type="number" min={0} max={80} value={years} onChange={(e) => setYears(e.target.value)} /></label>
          <label className="field">How would you rate your English?
            <select value={selfLevel} onChange={(e) => setSelfLevel(e.target.value)}>
              <option value="">Prefer not to say</option>
              {SELF.map((l) => <option key={l} value={l}>{l === "unknown" ? "I do not know" : l}</option>)}
            </select></label>
          <label className="field">Have you taken another English test?
            <select value={extTest} onChange={(e) => setExtTest(e.target.value)}>
              <option value="">No / prefer not to say</option>
              <option value="ielts">IELTS</option><option value="toefl">TOEFL</option><option value="cambridge">Cambridge exam</option>
              <option value="duolingo">Duolingo English Test</option><option value="toeic">TOEIC</option><option value="other">Other</option>
            </select></label>
          {extTest && <label className="field">Your score or level in that test<input type="text" maxLength={20} value={extScore} onChange={(e) => setExtScore(e.target.value)} /></label>}
        </fieldset>
        {error && <p className="err" role="alert">{error}</p>}
        <div><button className="btn primary" disabled={!canStart} onClick={start}>{busy ? "Starting…" : "Start Part 1"}</button></div>
      </main>
    );
  }

  if (step === "vocab") {
    return (
      <main className="wrap stack">
        <ol className="steps" aria-label="Progress"><li aria-current="step">Part 1: Words</li><li>Part 2: Reading</li></ol>
        {vi === 0 && <p className="muted">Is this a real English word that you know? Answer <strong>Yes</strong> only if you know what it means. Some words are not real English words.</p>}
        <div className="card">
          <p className="muted small" aria-live="polite">Word {vi + 1} of {words.length}</p>
          <p className="word" lang="en">{words[vi]}</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn primary" disabled={busy} onClick={() => answerWord(true)}>Yes, I know it</button>
            <button className="btn secondary" disabled={busy} onClick={() => answerWord(false)}>No / not sure</button>
          </div>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
      </main>
    );
  }

  if (step === "reading" || step === "finishing") {
    const p = passages[pi];
    if (!p) return null;
    const done = p.questions.every((q) => choices[q.id] !== undefined);
    return (
      <main className="wrap stack">
        <ol className="steps" aria-label="Progress"><li>Part 1: Words</li><li aria-current="step">Part 2: Reading</li></ol>
        <p className="muted small" aria-live="polite">Text {pi + 1} of {passages.length}</p>
        <article className="card stack" lang="en">
          <h2 style={{ margin: 0 }}>{p.title}</h2>
          <div className="passage">{p.text}</div>
        </article>
        {p.questions.map((q, qi) => (
          <div key={q.id} className="card stack" lang="en" role="radiogroup" aria-labelledby={"q-" + q.id}>
            <p id={"q-" + q.id} className="qtext">{qi + 1}. {q.stem}</p>
            {q.options.map((o, k) => (
              <label key={k} className={"opt" + (choices[q.id] === k ? " sel" : "")}>
                <input type="radio" name={q.id} checked={choices[q.id] === k} onChange={() => choose(q.id, k)} />
                <span className="dot" aria-hidden="true" /><span>{o}</span>
              </label>
            ))}
          </div>
        ))}
        {error && <p className="err" role="alert">{error}</p>}
        <div className="row between">
          <span className="muted small">You cannot go back to a previous text.</span>
          <button className="btn primary" disabled={!done || busy} onClick={nextPassage}>{pi + 1 < passages.length ? "Next text" : "Finish"}</button>
        </div>
      </main>
    );
  }

  if (step === "listening") {
    const c = clips[ci];
    if (!c) return null;
    const done = c.questions.every((q) => choices[q.id] !== undefined);
    return (
      <main className="wrap stack">
        <ol className="steps" aria-label="Progress"><li>Part 1: Words</li><li>Part 2: Reading</li><li aria-current="step">Part 3: Listening</li></ol>
        <p className="muted small" aria-live="polite">Recording {ci + 1} of {clips.length}</p>
        <section className="card stack" lang="en" key={c.id}>
          <h2 style={{ margin: 0 }}>{c.title}</h2>
          <AudioPlayer src={`/api/audio/${c.id}?token=${token}`} plays={c.plays} />
          <p className="muted small">You can play this recording {c.plays === 1 ? "once" : `${c.plays} times`}. You can answer while you listen.</p>
        </section>
        {c.questions.map((q, qi) => (
          <div key={q.id} className="card stack" lang="en" role="radiogroup" aria-labelledby={"q-" + q.id}>
            <p id={"q-" + q.id} className="qtext">{qi + 1}. {q.stem}</p>
            {q.options.map((o, k) => (
              <label key={k} className={"opt" + (choices[q.id] === k ? " sel" : "")}>
                <input type="radio" name={q.id} checked={choices[q.id] === k} onChange={() => choose(q.id, k)} />
                <span className="dot" aria-hidden="true" /><span>{o}</span>
              </label>
            ))}
          </div>
        ))}
        {error && <p className="err" role="alert">{error}</p>}
        <div className="row between">
          <span className="muted small">You cannot go back to a previous recording.</span>
          <button className="btn primary" disabled={!done || busy} onClick={nextClip}>{ci + 1 < clips.length ? "Next recording" : "Finish"}</button>
        </div>
      </main>
    );
  }

  return null;
}

#!/usr/bin/env python3
"""Проверка записей аудирования. Нужен ffprobe для длительности и громкости (ffmpeg).

  python3 check_audio.py content/listening content/audio

Для каждого сценария: есть ли файл, длительность против target_seconds (допуск от 0,65 до 1,45),
формат, частота, число каналов, пиковая громкость (по volumedetect, если есть ffmpeg).
Код возврата 1, если у какого-то сценария нет файла или есть ошибки.
"""
import glob
import json
import os
import re
import subprocess
import sys

EXT = [".mp3", ".m4a", ".ogg", ".webm", ".wav"]


def find(audio_dir, sid):
    for e in EXT:
        f = os.path.join(audio_dir, sid + e)
        if os.path.exists(f):
            return f
    return None


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels",
                          "-of", "json", path], capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        return None
    j = json.loads(out.stdout)
    st = (j.get("streams") or [{}])[0]
    return {"duration": float(j["format"]["duration"]), "codec": st.get("codec_name"),
            "rate": int(st.get("sample_rate", 0) or 0), "channels": st.get("channels")}


def max_volume(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True, timeout=120)
    m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else None


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) != 2:
        print(__doc__)
        return 2
    scripts_dir, audio_dir = argv
    scripts = []
    for f in sorted(glob.glob(os.path.join(scripts_dir, "*.json"))):
        scripts += json.load(open(f, encoding="utf-8"))
    missing, problems, ok = [], [], 0
    for s in scripts:
        f = find(audio_dir, s["id"])
        if not f:
            missing.append(s["id"])
            continue
        info = probe(f)
        if not info:
            problems.append("%s: файл не читается" % s["id"])
            continue
        ratio = info["duration"] / max(s.get("target_seconds", 1), 1)
        msg = []
        if not 0.65 <= ratio <= 1.45:
            msg.append("длительность %.0f с при ожидаемых %s с" % (info["duration"], s.get("target_seconds")))
        if info["duration"] < 3:
            msg.append("слишком короткая запись")
        mv = max_volume(f)
        if mv is not None and mv > -1.0:
            msg.append("пик %.1f дБ: возможно клиппирование" % mv)
        if mv is not None and mv < -20.0:
            msg.append("пик %.1f дБ: слишком тихо" % mv)
        if msg:
            problems.append("%s: %s" % (s["id"], "; ".join(msg)))
        else:
            ok += 1
    print("сценариев: %d, записей без замечаний: %d, без файла: %d, с замечаниями: %d" % (len(scripts), ok, len(missing), len(problems)))
    for m in missing:
        print("нет файла:", m)
    for p in problems:
        print("замечание:", p)
    return 1 if (missing or problems) else 0


if __name__ == "__main__":
    sys.exit(main())

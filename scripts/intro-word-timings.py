"""
Tempi parola per parola delle battute registrate dell'intro (sottotitoli "karaoke").

  python scripts/intro-word-timings.py            # tutte le clip (presentazione + regole)
  python scripts/intro-word-timings.py --model small

Per ogni clip in public/audio/intro/ e public/audio/regole/ scrive accanto `<nome>.words.json`:
  [{"w": "Benvenuti", "start": 0.12, "end": 0.61}, ...]
con le parole ESATTE del testo mostrato a video (scripts/intro-lines.ts), in secondi dall'inizio
della clip.

Come: trascrizione locale con faster-whisper (word_timestamps, nessun servizio a pagamento;
modello dalla cache di Hugging Face) → allineamento al testo del copione (difflib sulle parole
normalizzate) → le parole non riconosciute si distribuiscono per sillabe nello spazio tra le
vicine riconosciute → inizio/fine agganciati ai tratti con voce dell'inviluppo di energia (ffmpeg).
Senza faster-whisper: solo inviluppo di energia + distribuzione per sillabe sui tratti con voce.
Da rilanciare quando cambia una clip o il testo di una battuta.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import unicodedata

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 16000
HOP = 0.01  # 10 ms


def lines():
    npx = "npx.cmd" if os.name == "nt" else "npx"
    out = subprocess.run([npx, "tsx", "scripts/intro-lines.ts"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(out.stdout)


def pcm(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def voiced_segments(x):
    """Tratti con voce (s): energia RMS su 10 ms sopra una soglia adattiva, buchi < 120 ms richiusi."""
    n = int(SR * HOP)
    frames = len(x) // n
    if frames == 0:
        return [], 0.0
    rms = np.sqrt(np.mean(x[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    thr = max(np.percentile(db, 95) - 28, np.percentile(db, 10) + 6)
    on = db > thr
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            segs.append([start * HOP, i * HOP])
            start = None
    if start is not None:
        segs.append([start * HOP, frames * HOP])
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 0.12:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    merged = [s for s in merged if s[1] - s[0] > 0.04]
    return merged, frames * HOP


def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    w = re.sub(r"[^a-z0-9]", "", w)
    return re.sub(r"(.)\1+", r"\1", w)  # "cheeeee" → "che"


def syllables(w):
    v = re.findall(r"[aeiouyàèéìòóù]+", w.lower())
    return max(1, len(v))


def spread(tokens, t0, t1):
    """Distribuisce `tokens` (indici) su [t0, t1] in proporzione alle sillabe."""
    if not tokens:
        return {}
    weights = [syllables(tok[1]) + 0.3 for tok in tokens]
    tot = sum(weights)
    out, t = {}, t0
    for (i, _), wt in zip(tokens, weights):
        d = (t1 - t0) * wt / tot
        out[i] = (t, t + d)
        t += d
    return out


def transcribe(model, audio):
    # audio già decodificato (16 kHz mono float32): niente decoder PyAV
    segments, _ = model.transcribe(audio, language="it", word_timestamps=True, beam_size=5, vad_filter=False)
    words = []
    for seg in segments:
        for w in seg.words or []:
            if w.word.strip():
                words.append((w.word.strip(), float(w.start), float(w.end)))
    return words


def align(text, rec, voiced, dur):
    toks = text.split()
    times = [None] * len(toks)
    if rec:
        a = [norm(t) for t in toks]
        b = [norm(w[0]) for w in rec]
        sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size):
                _, s, e = rec[blk.b + k]
                times[blk.a + k] = [s, e]
        # parole quasi uguali (es. elisioni, numeri) nei tratti non allineati
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == "replace" and i2 - i1 == j2 - j1:
                for k in range(i2 - i1):
                    times[i1 + k] = [rec[j1 + k][1], rec[j1 + k][2]]
    v0 = voiced[0][0] if voiced else 0.0
    v1 = voiced[-1][1] if voiced else dur
    # buchi: parole senza tempo tra due ancore → per sillabe
    i = 0
    while i < len(toks):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(toks) and times[j] is None:
            j += 1
        t0 = times[i - 1][1] if i > 0 else v0
        t1 = times[j][0] if j < len(toks) else v1
        if t1 - t0 < 0.08 * (j - i):
            t1 = t0 + 0.12 * (j - i)
        for k, (s, e) in spread([(k, toks[k]) for k in range(i, j)], t0, t1).items():
            times[k] = [s, e]
        i = j
    # monotoni, dentro la clip, agganciati all'inizio/fine della voce
    out, last = [], 0.0
    for tok, (s, e) in zip(toks, times):
        s = max(s, last, 0.0)
        e = max(e, s + 0.06)
        out.append({"w": tok, "start": round(s, 3), "end": round(min(e, dur), 3)})
        last = s
    if out:
        out[0]["start"] = round(min(out[0]["start"], max(v0, 0.0)) if v0 < out[0]["start"] + 0.25 else out[0]["start"], 3)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="mobiuslabsgmbh/faster-whisper-large-v3-turbo")
    args = ap.parse_args()
    model = None
    try:
        from faster_whisper import WhisperModel  # type: ignore

        model = WhisperModel(args.model, device="cpu", compute_type="int8")
    except Exception as ex:  # noqa: BLE001
        print(f"[parole] faster-whisper non disponibile ({ex}): solo energia + sillabe", file=sys.stderr)
    for item in lines():
        path = os.path.join(ROOT, item["audio"])
        if not os.path.exists(path):
            print(f"[parole] manca {item['audio']}, salto")
            continue
        x = pcm(path)
        voiced, dur = voiced_segments(x)
        rec = transcribe(model, x) if model else []
        words = align(item["text"], rec, voiced, dur)
        dst = os.path.splitext(path)[0] + ".words.json"
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False)
        heard = " ".join(w[0] for w in rec)
        print(f"[parole] {os.path.relpath(dst, ROOT)}: {len(words)} parole, {dur:.2f}s | sentito: {heard[:90]}")


if __name__ == "__main__":
    main()

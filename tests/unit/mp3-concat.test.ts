import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { concatMp3, framesMs, isSilentFrame, Mp3Error, parseMp3, trimTrailingSilence } from "@/lib/server/mp3";

/** Frame MPEG-1 Layer III mono 128 kbit/s 44,1 kHz (417 byte) con side info scelta. */
function frame(opts: { gain?: number; bits?: number; rate48?: boolean; fill?: number } = {}): Buffer {
  const len = opts.rate48 ? 384 : 417; // 144 * 128000 / 48000 = 384
  const b = Buffer.alloc(len, opts.fill ?? 0x55);
  b[0] = 0xff;
  b[1] = 0xfb; // MPEG-1, Layer III, senza CRC
  b[2] = opts.rate48 ? 0x94 : 0x90; // 128 kbit/s, 44,1 / 48 kHz, senza padding
  b[3] = 0xc4; // mono
  b.fill(0, 4, 21); // side info (17 byte)
  // due granule: part2_3_length (12 bit) e global_gain (8 bit) a partire dal bit 18 e 18+59
  const put = (pos: number, n: number, v: number) => {
    for (let i = 0; i < n; i++) {
      const bit = (v >> (n - 1 - i)) & 1;
      const p = pos + i;
      if (bit) b[4 + (p >> 3)] |= 1 << (7 - (p & 7));
    }
  };
  for (const g of [18, 18 + 59]) {
    put(g, 12, opts.bits ?? 2000);
    put(g + 21, 8, opts.gain ?? 160);
  }
  return b;
}

/** Tag ID3v2 minimo (10 byte di intestazione + `size` byte). */
function id3(size: number): Buffer {
  const b = Buffer.alloc(10 + size);
  b.write("ID3", 0, "latin1");
  b[3] = 4;
  b[6] = (size >> 21) & 0x7f;
  b[7] = (size >> 14) & 0x7f;
  b[8] = (size >> 7) & 0x7f;
  b[9] = size & 0x7f;
  return b;
}

/** Primo frame "Info" (Xing CBR) come quello di ffmpeg/LAME. */
function infoFrame(): Buffer {
  const b = frame({ gain: 0, bits: 0, fill: 0 });
  b.write("Info", 4 + 17, "latin1");
  return b;
}

const FIXTURES = path.resolve(import.meta.dirname, "../fixtures/audio");
const fixture = (name: string) => readFileSync(path.join(FIXTURES, name));

describe("mp3: analisi dei frame", () => {
  it("salta ID3v2 e frame Info, conta solo i frame audio", () => {
    const buf = Buffer.concat([id3(34), infoFrame(), frame(), frame(), frame({ gain: 120 })]);
    const p = parseMp3(buf);
    expect(p.id3Bytes).toBe(44);
    expect(p.hadInfoFrame).toBe(true);
    expect(p.frames).toHaveLength(3);
    expect(p.format).toEqual({ version: 1, sampleRate: 44100, channels: 1 });
    expect(p.frames[0].offset).toBe(44 + 417);
    expect(framesMs(p)).toBeCloseTo((3 * 1152) / 44.1, 5);
  });

  it("silenzio: global_gain basso o granule vuote", () => {
    const p = parseMp3(Buffer.concat([frame({ gain: 160 }), frame({ gain: 120 }), frame({ gain: 210, bits: 0 })]));
    expect(p.frames.map(isSilentFrame)).toEqual([false, true, true]);
  });

  it("dati non mp3 → errore", () => {
    expect(() => parseMp3(Buffer.from("non sono un mp3, solo testo qualunque"))).toThrow(Mp3Error);
  });

  it("toglie il silenzio solo in coda, lasciando quanto richiesto", () => {
    const buf = Buffer.concat([frame({ gain: 120 }), frame(), frame(), ...Array.from({ length: 6 }, () => frame({ gain: 115 }))]);
    const p = parseMp3(buf);
    // il silenzio iniziale resta; in coda sempre almeno 3 frame di margine (mai sillabe mangiate)
    expect(trimTrailingSilence(p, 0)).toHaveLength(6);
    expect(trimTrailingSilence(p, 52)).toHaveLength(6); // ~2 frame da 26 ms: vale il margine minimo
    expect(trimTrailingSilence(p, 130)).toHaveLength(8); // ~5 frame
    expect(trimTrailingSilence(p, 10_000)).toHaveLength(9); // mai aggiunto
  });
});

describe("mp3: unione delle parti", () => {
  it("unisce i soli frame audio, senza tag né frame Info", () => {
    const a = Buffer.concat([id3(34), infoFrame(), frame(), frame()]);
    const b = Buffer.concat([id3(20), infoFrame(), frame(), frame(), frame()]);
    const r = concatMp3([{ audio: a }, { audio: b }]);
    expect(r.audio.length).toBe(5 * 417);
    expect(r.audio[0]).toBe(0xff);
    expect(r.audio.includes(Buffer.from("ID3"))).toBe(false);
    expect(r.audio.includes(Buffer.from("Info"))).toBe(false);
    const p = parseMp3(r.audio);
    expect(p.frames).toHaveLength(5);
    expect(p.hadInfoFrame).toBe(false);
    expect(r.durationMs).toBeCloseTo((5 * 1152) / 44.1, 5);
  });

  it("l'ordine delle parti è rispettato", () => {
    const a = frame({ fill: 0x11 });
    const b = frame({ fill: 0x22 });
    const r = concatMp3([{ audio: a }, { audio: b }]);
    expect(r.audio[416]).toBe(0x11);
    expect(r.audio[417 + 416]).toBe(0x22);
  });

  it("formati diversi → errore (si torna alla frase intera)", () => {
    expect(() => concatMp3([{ audio: frame() }, { audio: Buffer.concat([frame({ rate48: true }), frame({ rate48: true })]) }])).toThrow(Mp3Error);
  });

  it("mp3 veri (ffmpeg/LAME come ElevenLabs): unione e silenzio finale accorciato", () => {
    const a = fixture("tone-440.mp3");
    const b = fixture("tone-660.mp3");
    const pa = parseMp3(a);
    const pb = parseMp3(b);
    expect(pa.hadInfoFrame && pb.hadInfoFrame).toBe(true);
    expect(pa.id3Bytes).toBeGreaterThan(0);

    const plain = concatMp3([{ audio: a }, { audio: b }]);
    expect(parseMp3(plain.audio).frames).toHaveLength(pa.frames.length + pb.frames.length);
    expect(plain.trimmedMs).toBe(0);

    // ~250 ms di silenzio digitale in coda al primo tono: ne resta ~1 frame
    const trimmed = concatMp3([{ audio: a, tailMs: 30 }, { audio: b }]);
    const silentTail = pa.frames.length - 1 - pa.frames.findLastIndex((f) => !isSilentFrame(f));
    expect(silentTail).toBeGreaterThan(5);
    expect(trimmed.trimmedMs).toBeCloseTo(((silentTail - 3) * 1152) / 44.1, 3);
    expect(parseMp3(trimmed.audio).frames).toHaveLength(pa.frames.length - (silentTail - 3) + pb.frames.length);
    // durata = byte / 16 (128 kbit/s), come la stima del tempo di lettura
    expect(trimmed.audio.length / 16).toBeCloseTo(trimmed.durationMs, -1);
  });
});

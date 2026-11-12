/**
 * Unione di mp3 senza ricodifica (per le battute con i nomi "salvati").
 *
 * Le clip di ElevenLabs (output_format mp3_44100_128) sono prodotte con ffmpeg/LAME:
 * tag ID3v2 ("Lavf…"), un primo frame "Info" (Xing CBR con conteggio frame e ritardo
 * dell'encoder) e poi frame MPEG-1 Layer III mono a 128 kbit/s. Per unirle:
 * - si tolgono ID3v2/ID3v1 e i frame Info/Xing/VBRI di TUTTE le parti (il frame Info della
 *   prima dichiarerebbe la durata sbagliata del file unito);
 * - si concatenano i soli frame audio, che hanno tutti lo stesso formato (stessa frequenza,
 *   stessi canali): il risultato è un normale mp3 CBR, la durata resta byte/16 ms;
 * - facoltativo: si accorcia il silenzio IN CODA alle parti intermedie scartando frame interi
 *   silenziosi. Si lavora solo sulla coda: i dati di un frame possono stare nei frame
 *   PRECEDENTI (bit reservoir), mai in quelli successivi, quindi togliere frame finali non
 *   rovina quelli che restano. Il silenzio iniziale (1–2 frame, ~40 ms) non si tocca: toglierlo
 *   romperebbe il bit reservoir del primo frame di parlato.
 * Un frame è "silenzioso" se ogni sua granula è vuota (part2_3_length = 0: silenzio digitale)
 * oppure ha un global_gain basso: in CBR l'encoder spende comunque tutti i bit anche sul
 * fruscio, ma il passo di quantizzazione segue il volume. Sulle clip reali di ElevenLabs
 * (mono, 128 kbit/s) il parlato sta a 140–175, il fruscio delle pause (< -65 dB) a 110–134.
 */

export interface Mp3Format {
  /** 1 = MPEG-1, 2 = MPEG-2, 25 = MPEG-2.5 */
  version: 1 | 2 | 25;
  sampleRate: number;
  channels: 1 | 2;
}

export interface Mp3Frame {
  offset: number;
  length: number;
  /** global_gain massimo fra le granule NON vuote (0 se tutte vuote): segue il volume del frame */
  gain: number;
  /** campioni per canale (1152 MPEG-1, 576 MPEG-2/2.5) */
  samples: number;
}

export interface ParsedMp3 {
  format: Mp3Format;
  frames: Mp3Frame[];
  /** frame Info/Xing/VBRI trovato (e scartato) all'inizio */
  hadInfoFrame: boolean;
  /** byte di tag ID3 scartati */
  id3Bytes: number;
}

export class Mp3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Mp3Error";
  }
}

const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const RATES: Record<1 | 2 | 25, number[]> = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000] };

interface Header {
  version: 1 | 2 | 25;
  crc: boolean;
  bitrate: number;
  sampleRate: number;
  padding: number;
  channels: 1 | 2;
  length: number;
  samples: number;
  sideInfo: number;
}

/** Intestazione di un frame Layer III all'offset dato (null se non valida). */
function readHeader(b: Uint8Array, o: number): Header | null {
  if (o + 4 > b.length) return null;
  if (b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null;
  const vBits = (b[o + 1] >> 3) & 3;
  const layer = (b[o + 1] >> 1) & 3;
  if (vBits === 1 || layer !== 1) return null; // versione riservata o non Layer III
  const version: 1 | 2 | 25 = vBits === 3 ? 1 : vBits === 2 ? 2 : 25;
  const crc = (b[o + 1] & 1) === 0;
  const brIdx = (b[o + 2] >> 4) & 15;
  const srIdx = (b[o + 2] >> 2) & 3;
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null; // free format o valori non validi
  const bitrate = (version === 1 ? BITRATES_V1 : BITRATES_V2)[brIdx] * 1000;
  const sampleRate = RATES[version][srIdx];
  const padding = (b[o + 2] >> 1) & 1;
  const channels: 1 | 2 = ((b[o + 3] >> 6) & 3) === 3 ? 1 : 2;
  const length = Math.floor(((version === 1 ? 144 : 72) * bitrate) / sampleRate) + padding;
  const samples = version === 1 ? 1152 : 576;
  const sideInfo = version === 1 ? (channels === 1 ? 17 : 32) : channels === 1 ? 9 : 17;
  return { version, crc, bitrate, sampleRate, padding, channels, length, samples, sideInfo };
}

/** Legge `n` bit (big endian) a partire dal bit `pos` di `b`. */
function bitsAt(b: Uint8Array, start: number, pos: number, n: number): number {
  let v = 0;
  for (let i = 0; i < n; i++) {
    const p = pos + i;
    v = (v << 1) | ((b[start + (p >> 3)] >> (7 - (p & 7))) & 1);
  }
  return v;
}

/**
 * global_gain massimo fra le granule non vuote del frame (side info: in ogni granula
 * part2_3_length 12 bit, big_values 9 bit, poi global_gain 8 bit). Le granule senza dati
 * (part2_3_length = 0, silenzio digitale) non contano: LAME vi scrive comunque gain 210.
 */
function frameGain(b: Uint8Array, o: number, h: Header): number {
  const si = o + 4 + (h.crc ? 2 : 0);
  if (si + h.sideInfo > b.length) return 255;
  let max = 0;
  const granule = (pos: number) => {
    if (bitsAt(b, si, pos, 12) > 0) max = Math.max(max, bitsAt(b, si, pos + 21, 8));
  };
  if (h.version === 1) {
    // main_data_begin 9, private 5|3, scfsi 4 per canale, poi 59 bit per granula/canale
    let pos = 9 + (h.channels === 1 ? 5 : 3) + 4 * h.channels;
    for (let gr = 0; gr < 2; gr++)
      for (let ch = 0; ch < h.channels; ch++) {
        granule(pos);
        pos += 59;
      }
  } else {
    // MPEG-2/2.5: main_data_begin 8, private 1|2, una granula da 63 bit per canale
    let pos = 8 + (h.channels === 1 ? 1 : 2);
    for (let ch = 0; ch < h.channels; ch++) {
      granule(pos);
      pos += 63;
    }
  }
  return max;
}

/** Il frame è un'intestazione Info/Xing/VBRI (metadati, nessun audio)? */
function isInfoFrame(b: Uint8Array, o: number, h: Header): boolean {
  const xing = o + 4 + (h.crc ? 2 : 0) + h.sideInfo;
  const tag = (p: number) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
  if (xing + 4 <= b.length && (tag(xing) === "Xing" || tag(xing) === "Info")) return true;
  return o + 40 <= b.length && tag(o + 36) === "VBRI";
}

/** Byte del tag ID3v2 iniziale (0 se assente). */
function id3v2Size(b: Uint8Array): number {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0; // "ID3"
  const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
  const footer = (b[5] & 0x10) !== 0 ? 10 : 0;
  return 10 + size + footer;
}

/** Analizza un mp3: tag e frame Info esclusi, solo frame audio. */
export function parseMp3(buf: Uint8Array): ParsedMp3 {
  let o = id3v2Size(buf);
  const id3Bytes = o;
  let end = buf.length;
  // ID3v1 in coda ("TAG", 128 byte)
  if (end >= 128 && buf[end - 128] === 0x54 && buf[end - 127] === 0x41 && buf[end - 126] === 0x47) end -= 128;
  const frames: Mp3Frame[] = [];
  let format: Mp3Format | null = null;
  let hadInfoFrame = false;
  while (o + 4 <= end) {
    const h = readHeader(buf, o);
    const started = format !== null;
    if (started) {
      // dentro l'audio: dati estranei o frame troncato → ci si ferma
      if (!h || o + h.length > end) break;
    } else if (!h || o + h.length > end || (o + h.length + 4 <= end && !readHeader(buf, o + h.length))) {
      // prima del primo frame: il frame è valido solo se è seguito da un altro frame (o dalla fine)
      o++;
      continue;
    }
    if (!format) {
      format = { version: h.version, sampleRate: h.sampleRate, channels: h.channels };
      if (isInfoFrame(buf, o, h)) {
        hadInfoFrame = true;
        o += h.length;
        continue;
      }
    } else if (h.version !== format.version || h.sampleRate !== format.sampleRate || h.channels !== format.channels) {
      throw new Mp3Error("Formato mp3 non uniforme all'interno della clip");
    }
    frames.push({ offset: o, length: h.length, gain: frameGain(buf, o, h), samples: h.samples });
    o += h.length;
  }
  if (!format || frames.length === 0) throw new Mp3Error("Nessun frame mp3 valido");
  return { format, frames, hadInfoFrame, id3Bytes };
}

/** Durata in millisecondi dei frame audio. */
export function framesMs(p: ParsedMp3, frames = p.frames): number {
  return frames.reduce((a, f) => a + f.samples, 0) / (p.format.sampleRate / 1000);
}

/**
 * global_gain massimo di un frame "silenzioso" (0 = frame vuoto). Tarato sulle clip reali:
 * ≤ 134 corrisponde a meno di ~-65 dB (code di respiro e fruscio dopo l'ultima parola).
 */
export const SILENT_MAX_GAIN = 134;

export function isSilentFrame(f: Mp3Frame): boolean {
  return f.gain <= SILENT_MAX_GAIN;
}

/** Frame (≈26 ms l'uno a 44,1 kHz) sempre tenuti dopo l'ultimo frame sonoro. */
const SAFETY_TAIL_FRAMES = 3;

/**
 * Frame da tenere togliendo il silenzio in coda oltre `keepMs` (mai aggiunto: se il silenzio
 * è già più corto resta com'è). Restituisce almeno un frame.
 */
export function trimTrailingSilence(p: ParsedMp3, keepMs: number): Mp3Frame[] {
  const frames = p.frames;
  let last = frames.length - 1;
  while (last > 0 && isSilentFrame(frames[last])) last--;
  const frameMs = framesMs(p, [frames[0]]);
  // margine di sicurezza: la fine di una parola detta piano (consonante, respiro) può sembrare
  // silenzio; almeno ~80 ms oltre l'ultimo frame "sonoro" restano sempre (mai sillabe mangiate)
  const keep = Math.max(SAFETY_TAIL_FRAMES, Math.round(keepMs / frameMs));
  return frames.slice(0, Math.min(frames.length, last + 1 + keep));
}

export interface ConcatPart {
  audio: Uint8Array;
  /**
   * Silenzio massimo da lasciare in coda a questa parte (ms). `undefined` = coda intatta
   * (di solito l'ultima parte).
   */
  tailMs?: number;
}

export interface ConcatResult {
  audio: Buffer;
  format: Mp3Format;
  /** durata dei frame audio (ms) */
  durationMs: number;
  /** silenzio tolto in totale (ms) */
  trimmedMs: number;
}

/** Unisce più mp3 dello stesso formato in un unico mp3 (solo frame audio, senza tag). */
export function concatMp3(parts: ConcatPart[]): ConcatResult {
  if (parts.length === 0) throw new Mp3Error("Nessuna parte da unire");
  const chunks: Buffer[] = [];
  let format: Mp3Format | null = null;
  let durationMs = 0;
  let trimmedMs = 0;
  for (const part of parts) {
    const p = parseMp3(part.audio);
    if (!format) format = p.format;
    else if (p.format.version !== format.version || p.format.sampleRate !== format.sampleRate || p.format.channels !== format.channels) {
      throw new Mp3Error("Le parti hanno formati mp3 diversi");
    }
    const kept = part.tailMs === undefined ? p.frames : trimTrailingSilence(p, part.tailMs);
    trimmedMs += framesMs(p) - framesMs(p, kept);
    durationMs += framesMs(p, kept);
    // i frame sono contigui: un solo blocco dal primo all'ultimo tenuto
    const first = kept[0];
    const last = kept[kept.length - 1];
    chunks.push(Buffer.from(part.audio.buffer, part.audio.byteOffset + first.offset, last.offset + last.length - first.offset));
  }
  return { audio: Buffer.concat(chunks), format: format!, durationMs, trimmedMs };
}

/**
 * Interruttori diagnostici dell'arena (`?dbg=noreflect,nocones` oppure `?dbg=all`): servono a misurare quanto costa
 * ogni parte sul dispositivo. `?lvl=0..4` fissa il gradino del profilo di resa (perf.ts) e spegne il regolatore.
 * Altri interruttori per misurare il postprocessing: `nopost` (disegno diretto), `ldr` (buffer a 8 bit),
 * `hdr` (buffer a mezza precisione), `fxaa` / `smaa` / `noaa`, `nobloom`, `nodust`, `nohosts`; parti della baia
 * e del set: `nosky`, `nosea`, `noship`, `nopalms`, `noflames`, `nodeck`, `norig`, `nopods`, `nomascots`.
 * `?dpr=0.5..2` fissa la densità di pixel. Senza i parametri non cambiano nulla.
 */
export interface ArenaDebug {
  noReflect: boolean;
  noCones: boolean;
  /** gradino del profilo di resa forzato (null = automatico) */
  level: 0 | 1 | 2 | 3 | 4 | null;
  /** densità di pixel forzata (null = dal profilo) */
  dpr: number | null;
  /** altri interruttori (vedi sopra) */
  flags: string[];
}

export function readArenaDebug(): ArenaDebug {
  let v = "";
  let lvl: string | null = null;
  let dpr: string | null = null;
  try {
    const q = new URLSearchParams(window.location.search);
    v = q.get("dbg") ?? "";
    lvl = q.get("lvl");
    dpr = q.get("dpr");
  } catch {
    /* fuori dal browser */
  }
  const all = v.includes("all");
  const n = lvl != null && /^[0-4]$/.test(lvl) ? (Number(lvl) as 0 | 1 | 2 | 3 | 4) : null;
  const d = dpr != null && Number(dpr) >= 0.5 && Number(dpr) <= 2 ? Number(dpr) : null;
  return { noReflect: all || v.includes("noreflect"), noCones: all || v.includes("nocones"), level: n, dpr: d, flags: v.split(",").filter(Boolean) };
}

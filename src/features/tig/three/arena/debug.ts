/**
 * Interruttori diagnostici dell'arena (`?dbg=noreflect,nocones` oppure `?dbg=all`): servono a misurare quanto costa
 * ogni parte sul dispositivo. `?lvl=0..4` fissa il gradino del profilo di resa (perf.ts) e spegne il regolatore.
 * Senza i parametri non cambiano nulla.
 */
export interface ArenaDebug {
  noReflect: boolean;
  noCones: boolean;
  /** gradino del profilo di resa forzato (null = automatico) */
  level: 0 | 1 | 2 | 3 | 4 | null;
}

export function readArenaDebug(): ArenaDebug {
  let v = "";
  let lvl: string | null = null;
  try {
    const q = new URLSearchParams(window.location.search);
    v = q.get("dbg") ?? "";
    lvl = q.get("lvl");
  } catch {
    /* fuori dal browser */
  }
  const all = v.includes("all");
  const n = lvl != null && /^[0-4]$/.test(lvl) ? (Number(lvl) as 0 | 1 | 2 | 3 | 4) : null;
  return { noReflect: all || v.includes("noreflect"), noCones: all || v.includes("nocones"), level: n };
}

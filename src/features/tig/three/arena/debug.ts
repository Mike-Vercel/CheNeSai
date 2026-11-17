/**
 * Interruttori diagnostici dell'arena (`?dbg=noreflect,nocones` oppure `?dbg=all`): servono a misurare quanto costa
 * ogni parte sul dispositivo. Senza il parametro non cambiano nulla.
 */
export interface ArenaDebug {
  noReflect: boolean;
  noCones: boolean;
}

export function readArenaDebug(): ArenaDebug {
  let v = "";
  try {
    v = new URLSearchParams(window.location.search).get("dbg") ?? "";
  } catch {
    /* fuori dal browser */
  }
  const all = v.includes("all");
  return { noReflect: all || v.includes("noreflect"), noCones: all || v.includes("nocones") };
}

/**
 * Quando si vede l'INTRO di GIRAMENTE! (pagina «Nuova partita»), come in PSYCO:
 *  - una volta per scheda del browser (sessionStorage): rivincite e ritorni alla pagina non la ripetono;
 *  - `?intro=1` la forza (anche nei test automatici), `?intro=0` la spegne;
 *  - test automatici (navigator.webdriver): niente intro, salvo `?intro=1`.
 * La stanza creata subito dopo l'intro è segnata come «già salutata»: in sala d'attesa Don Patrizio non ripete
 * il benvenuto (vedi `direct` in ../director.ts). Si legge solo nel browser.
 */
const CREATE_KEY = "giramente.intro.nuova.v1";
const welcomedKey = (roomId: string) => `giramente.benvenuto.v1:${roomId}`;

function introParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("intro");
  } catch {
    return null;
  }
}

/** Va mostrata l'intro all'ingresso in «Nuova partita»? (solo lettura) */
export function shouldShowCreateIntro(): boolean {
  if (typeof window === "undefined") return false;
  const p = introParam();
  if (p === "0") return false;
  if (p === "1") return true;
  if (navigator.webdriver) return false;
  try {
    return sessionStorage.getItem(CREATE_KEY) !== "1";
  } catch {
    return true;
  }
}

export function markCreateIntroSeen() {
  try {
    sessionStorage.setItem(CREATE_KEY, "1");
  } catch {
    /* modalità privata: pazienza */
  }
}

// l'intro è andata in scena in QUESTA pagina (la partita creata adesso ha già avuto il benvenuto)
let playedHere = false;
export function noteIntroPlayed() {
  playedHere = true;
}
export function introPlayedHere(): boolean {
  return playedHere;
}

/** La stanza appena creata ha già avuto il benvenuto (nell'intro): in sala d'attesa non si ripete. */
export function markRoomWelcomed(roomId: string) {
  try {
    sessionStorage.setItem(welcomedKey(roomId), "1");
  } catch {
    /* modalità privata: il benvenuto si ripete, pazienza */
  }
}

export function isRoomWelcomed(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(welcomedKey(roomId)) === "1";
  } catch {
    return false;
  }
}

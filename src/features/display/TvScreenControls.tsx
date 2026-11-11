"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseScreen,
  fullscreenOn,
  hasMultipleScreens,
  isTvScreenMessage,
  loadScreenChoice,
  loadScreens,
  openTvWindow,
  saveScreenChoice,
  screenApiSupported,
  screenPermission,
  tvChannelName,
  type ScreenInfo,
  type TvScreenMessage,
} from "./screen-picker";

function channel(sessionId: string): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(tvChannelName(sessionId)) : null;
  } catch {
    return null;
  }
}

/**
 * "Apri TV" con scelta dello schermo (regia e host del gioco libero).
 * - Più schermi + Chrome/Edge: elenco "Schermo 1 – principale …", "Schermo 2 – TV …"; la scelta resta
 *   salvata su questo PC e il TV si apre lì, a schermo intero quando il browser lo consente.
 * - Durante la partita: "Sposta su schermo N" (la finestra del TV si sposta da sola, o chiede un clic).
 * - Un solo schermo o browser senza supporto: finestra normale + istruzioni (trascinala e premi F11).
 */
export function OpenTvButton({ url, sessionId, className, compact }: { url: string; sessionId: string; className?: string; compact?: boolean }) {
  const [screens, setScreens] = useState<ScreenInfo[] | null>(null);
  const [chooser, setChooser] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const winRef = useRef<Window | null>(null);
  const chRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const ch = channel(sessionId);
    chRef.current = ch;
    if (!ch) return;
    ch.onmessage = (e) => {
      if (isTvScreenMessage(e.data) && e.data.type === "pong") {
        setOpened(true);
        if (e.data.key) setCurrent(e.data.key);
      }
    };
    // il TV è già aperto (es. dopo un ricaricamento di questa pagina)?
    ch.postMessage({ type: "ping" } satisfies TvScreenMessage);
    return () => ch.close();
  }, [sessionId]);

  const fallbackOpen = useCallback(
    (why: string) => {
      winRef.current = window.open(url, "_blank");
      setOpened(!!winRef.current);
      setNote(winRef.current ? why : "Il browser ha bloccato la finestra: consenti i popup per questo sito.");
    },
    [url],
  );

  const openOn = useCallback(
    async (s: ScreenInfo) => {
      saveScreenChoice(s.key);
      setCurrent(s.key);
      setChooser(false);
      const perm = await screenPermission();
      const w = openTvWindow(url, sessionId, s, perm === "granted");
      winRef.current = w;
      setOpened(!!w);
      setNote(w ? null : "Il browser ha bloccato la finestra: consenti i popup per questo sito e riprova.");
      // se il TV era già aperto altrove, si sposta da solo
      chRef.current?.postMessage({ type: "move", key: s.key } satisfies TvScreenMessage);
    },
    [url, sessionId],
  );

  async function onOpen() {
    setNote(null);
    if (!screenApiSupported()) {
      fallbackOpen("Trascina la finestra sul televisore e premi F11 (schermo intero). Con Chrome o Edge il TV si apre da solo sullo schermo giusto.");
      return;
    }
    if (!hasMultipleScreens() && (await screenPermission()) !== "granted") {
      fallbackOpen("C'è un solo schermo: collega il televisore (HDMI, schermo esteso) oppure premi F11 per lo schermo intero.");
      return;
    }
    const r = await loadScreens(); // la prima volta Chrome chiede il permesso "Gestione finestre"
    if (!r || r.screens.length <= 1) {
      fallbackOpen(r ? "C'è un solo schermo: premi F11 sulla finestra del TV per lo schermo intero." : "Permesso negato: trascina la finestra sul televisore e premi F11.");
      return;
    }
    setScreens(r.screens);
    const saved = loadScreenChoice();
    const pick = chooseScreen(r.screens, saved);
    if (saved && pick?.key === saved) await openOn(pick);
    else setChooser(true);
  }

  async function showChooser() {
    const r = await loadScreens();
    if (r) setScreens(r.screens);
    setChooser((c) => !c);
  }

  const currentLabel = screens?.find((s) => s.key === current)?.label;
  const multi = !!screens && screens.length > 1;

  return (
    <div className={clsx("relative inline-flex flex-col items-start gap-1", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void onOpen()} className="qz-tv-open rounded-lg bg-electric px-3 py-1.5 text-sm font-extrabold text-white hover:brightness-110">
          📺 {opened ? "Riapri TV" : "Apri TV"}
        </button>
        {screenApiSupported() && (
          <button type="button" onClick={() => void showChooser()} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-bold text-white/85 hover:bg-white/20" aria-expanded={chooser}>
            {opened && multi ? "Sposta su…" : "Schermo…"}
          </button>
        )}
      </div>
      {!compact && currentLabel && <p className="text-xs font-bold text-white/60">TV su {currentLabel}</p>}
      {chooser && screens && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[90vw] rounded-xl border border-white/15 bg-[#1d0c30] p-2 shadow-2xl">
          <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-white/50">{opened ? "Sposta il TV su" : "Su quale schermo apro il TV?"}</p>
          {screens.map((s) => (
            <button
              key={s.key}
              role="menuitem"
              type="button"
              onClick={() => void openOn(s)}
              className={clsx("block w-full rounded-lg px-2 py-2 text-left text-sm font-bold hover:bg-white/10", s.key === current ? "text-gold" : "text-white")}
            >
              {s.label}
              {s.key === current && " ✓"}
            </button>
          ))}
          {screens.length <= 1 && <p className="px-2 py-1 text-xs text-white/60">Un solo schermo trovato: collega il TV in modalità &laquo;Estendi&raquo;.</p>}
        </div>
      )}
      {note && <p className="max-w-xs text-xs font-bold text-white/70">{note}</p>}
    </div>
  );
}

/**
 * Nella finestra del TV: riceve "sposta su schermo N" dalla regia/host e offre un piccolo
 * comando discreto (in basso a sinistra, compare muovendo il mouse) per lo schermo intero e
 * per cambiare schermo. Se il browser vuole un clic, mostra "Tocca per schermo intero".
 */
export function TvScreenAgent({ sessionId, showButton = true, audioOn = true }: { sessionId: string; showButton?: boolean; audioOn?: boolean }) {
  const [needsTap, setNeedsTap] = useState<string | null | false>(false);
  const [visible, setVisible] = useState(false);
  const [menu, setMenu] = useState(false);
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const keyRef = useRef<string | null>(null);
  const audioRef = useRef(audioOn);
  useEffect(() => {
    audioRef.current = audioOn;
  }, [audioOn]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goFullscreen = useCallback(async (key: string | null) => {
    keyRef.current = key;
    const okFs = await fullscreenOn(key);
    if (key) saveScreenChoice(key);
    setNeedsTap(okFs ? false : key);
  }, []);

  useEffect(() => {
    const ch = channel(sessionId);
    if (!ch) return;
    ch.onmessage = (e) => {
      if (!isTvScreenMessage(e.data)) return;
      const m = e.data;
      if (m.type === "ping") ch.postMessage({ type: "pong", key: keyRef.current ?? loadScreenChoice(), fullscreen: !!document.fullscreenElement, audio: audioRef.current } satisfies TvScreenMessage);
      else if (m.type === "move") void goFullscreen(m.key);
      else if (m.type === "fullscreen") void goFullscreen(keyRef.current);
    };
    return () => ch.close();
  }, [sessionId, goFullscreen]);

  useEffect(() => {
    const onMove = () => {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        setMenu(false);
      }, 3500);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  async function openMenu() {
    if (screenApiSupported() && (hasMultipleScreens() || (await screenPermission()) === "granted")) {
      const r = await loadScreens();
      setScreens(r?.screens ?? []);
    }
    setMenu((m) => !m);
  }

  return (
    <>
      {showButton && (
      <div className={clsx("absolute left-[1cqw] top-[3.5cqh] z-[65] flex flex-col-reverse transition-opacity duration-300", visible || menu ? "opacity-100" : "pointer-events-none opacity-0")} onDoubleClick={(e) => e.stopPropagation()}>
        {menu && (
          <div className="mt-2 w-72 rounded-xl border border-white/15 bg-[#1d0c30]/95 p-2 text-sm text-white shadow-2xl">
            <button type="button" className="block w-full rounded-lg px-2 py-2 text-left font-bold hover:bg-white/10" onClick={() => void goFullscreen(null)}>
              ⛶ Schermo intero qui
            </button>
            {screens.length > 1 &&
              screens.map((s) => (
                <button key={s.key} type="button" className="block w-full rounded-lg px-2 py-2 text-left font-bold hover:bg-white/10" onClick={() => void goFullscreen(s.key)}>
                  Sposta su {s.label}
                </button>
              ))}
            {!screenApiSupported() && <p className="px-2 py-1 text-xs text-white/60">Per cambiare schermo trascina la finestra e premi F11.</p>}
          </div>
        )}
        <button type="button" aria-label="Schermo del TV" onClick={() => void openMenu()} className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur hover:bg-black/75">
          🖥 Schermo
        </button>
      </div>
      )}
      {needsTap !== false && (
        <div className="absolute inset-0 z-[80] grid place-items-center bg-night/70 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => void goFullscreen(needsTap)}
            className="rounded-3xl border-4 border-[#b8770a] bg-gradient-to-b from-[#ffe680] to-gold-deep px-12 py-8 font-display text-4xl text-ink shadow-[0_8px_0_#9a5d00]"
          >
            Tocca per schermo intero
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Scelta dello schermo del TV in anticipo (serata rapida, nuova partita libera):
 * la scelta resta su questo PC e "Apri TV" la userà senza chiedere di nuovo.
 */
export function ScreenChoiceField({ className, tone = "admin" }: { className?: string; tone?: "admin" | "public" }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [screens, setScreens] = useState<ScreenInfo[] | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    // dopo il montaggio: dipende dal browser (niente differenze tra server e client)
    const t = setTimeout(() => {
      setSupported(screenApiSupported());
      setSaved(loadScreenChoice());
      void screenPermission().then(async (p) => {
        if (p === "granted") setScreens((await loadScreens())?.screens ?? null);
      });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function load() {
    const r = await loadScreens();
    setScreens(r?.screens ?? []);
  }

  const label = tone === "public" ? "text-white/75" : "text-white/70";
  if (supported === null) return null;
  if (!supported) {
    return <p className={clsx("text-sm", label, className)}>Schermo TV: si aprirà in una nuova finestra, trascinala sul televisore e premi F11 (con Chrome o Edge puoi scegliere lo schermo in automatico).</p>;
  }
  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <p className={clsx("text-sm font-bold", label)}>Su quale schermo apro il TV?</p>
      {!screens ? (
        <button type="button" onClick={() => void load()} className="w-fit rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20">
          🖥 Trova gli schermi collegati
        </button>
      ) : screens.length <= 1 ? (
        <p className={clsx("text-sm", label)}>Un solo schermo collegato: collega il televisore con HDMI in modalità &laquo;Estendi&raquo; oppure userai F11.</p>
      ) : (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Schermo del TV">
          {screens.map((s) => {
            const on = (chooseScreen(screens, saved)?.key ?? null) === s.key && saved === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  saveScreenChoice(s.key);
                  setSaved(s.key);
                }}
                className={clsx("rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition", on ? "border-gold bg-gold/15 text-white" : "border-white/15 text-white/80 hover:border-white/40")}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

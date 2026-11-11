"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CAPTIONS, FLASHES, type CaptionDef } from "./timeline";
import type { IntroTimelineState, SpokenLine } from "./use-intro-timeline";
import { DISPLAY_FONT_STACK } from "./assets";
import { DEFAULT_SCORING, INTRO_CLIP_DIR, RULES, RULES_AUDIO_DIR, ruleBody, type RuleIcon, type RulesScoring } from "./rules";
import { INTRO_SPEECH } from "@/features/game/speech";
import { cachedWords, chunkStarts, loadWords, wordIndexAt, wordsFor, wordsUrl } from "./karaoke";

/** Didascalie sostituite dai sottotitoli karaoke (battute registrate della presentazione). */
const SPOKEN_CAPTIONS = new Set<string>(INTRO_SPEECH.filter((l) => l.clipWho !== null).map((l) => l.clip));

/**
 * Overlay DOM sopra la scena (o sopra il fallback 2D): didascalie enormi,
 * countdown, lampi, bande cinema. Le misure usano unità container (cqh/cqw)
 * con fallback vh/vw per i browser TV più vecchi.
 */
export const OVERLAY_CSS = `
.qz-intro{container-type:size;font-family:${DISPLAY_FONT_STACK};}
.qz-cap-text{font-size:5.8vh;font-size:5.8cqh;line-height:1.02;letter-spacing:.01em;color:#fff;
  -webkit-text-stroke:.13em #1a0526;paint-order:stroke fill;
  text-shadow:0 .07em 0 #1a0526,0 .12em .3em rgba(0,0,0,.55);}
.qz-cap-panel{border-radius:2.2vh;border-radius:2.2cqh;padding:2.4vh 3.2vh 2.8vh;padding:2.4cqh 3.2cqh 2.8cqh;
  background:linear-gradient(160deg,rgba(32,8,56,.92),rgba(23,8,36,.78));
  border:.5vh solid #FFD43B;border:.5cqh solid #FFD43B;
  box-shadow:0 0 0 .35cqh rgba(255,184,0,.35),0 1.2cqh 4cqh rgba(0,0,0,.55),inset 0 0 3cqh rgba(255,20,147,.18);}
.qz-cap-tag{display:inline-block;font-size:3.3vh;font-size:3.3cqh;letter-spacing:.08em;color:#fff;
  padding:.5cqh 1.8cqh .7cqh;border-radius:99px;margin-bottom:1.4cqh;
  -webkit-text-stroke:.1em rgba(0,0,0,.35);paint-order:stroke fill;}
@keyframes qz-ann-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
.qz-ann{font-size:9.5vh;font-size:9.5cqh;line-height:1;white-space:nowrap;
  background:linear-gradient(180deg,#ffffff 0%,#ffe680 35%,#FFB800 60%,#ff2a9a 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 .05em 0 #4a0a52) drop-shadow(0 0 .35em rgba(255,20,147,.85));animation:qz-ann-pulse .45s ease-in-out infinite;}
.qz-ann-stroke{position:absolute;inset:0;color:transparent;-webkit-text-stroke:.14em #1a0526;white-space:nowrap;}
.qz-final{font-size:10vh;font-size:10cqh;line-height:1;
  background:linear-gradient(180deg,#fff6c9 0%,#FFD43B 45%,#FFB800 70%,#ff8a00 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 .06em 0 #5a1a00) drop-shadow(0 0 .25em rgba(255,20,147,.55));}
.qz-final-stroke{position:absolute;inset:0;color:transparent;-webkit-text-stroke:.16em #1a0526;}
.qz-rule{width:40cqw;border-radius:2.4cqh;padding:2cqh 2.6cqh;display:flex;gap:2.2cqh;align-items:center;
  background:linear-gradient(160deg,rgba(32,8,56,.94),rgba(23,8,36,.86));border:.5cqh solid #FFD43B;
  box-shadow:0 0 0 .35cqh rgba(255,184,0,.35),0 1.2cqh 4cqh rgba(0,0,0,.55);}
.qz-rule-icon{flex:none;width:13cqh;height:13cqh;border-radius:50%;display:flex;align-items:center;justify-content:center;
  box-shadow:inset 0 -.8cqh 1.6cqh rgba(0,0,0,.35),0 0 2.5cqh currentColor;}
.qz-rule-title{white-space:nowrap;line-height:1;color:#FFD43B;-webkit-text-stroke:.12em #1a0526;paint-order:stroke fill;}
.qz-rule-body{white-space:nowrap;line-height:1.1;color:#fff;margin-top:.8cqh;-webkit-text-stroke:.1em #1a0526;paint-order:stroke fill;}
.qz-rule-dots{display:flex;gap:.7cqh;margin-top:1.2cqh}
.qz-rule-dots i{width:1.1cqh;height:1.1cqh;border-radius:50%;background:rgba(255,255,255,.25)}
.qz-rule-dots i.on{background:#FFD43B;box-shadow:0 0 1cqh #FFD43B}
.qz-final-sub{font-size:3.6vh;font-size:3.6cqh;letter-spacing:.2em;color:#fff;-webkit-text-stroke:.12em #1a0526;paint-order:stroke fill;}
.qz-kara{width:64cqw;border-radius:2cqh;padding:1.2cqh 2.6cqh 1.5cqh;text-align:center;
  background:linear-gradient(160deg,rgba(32,8,56,.9),rgba(23,8,36,.8));border:.5cqh solid #FFD43B;
  box-shadow:0 0 0 .35cqh rgba(255,184,0,.35),0 1.2cqh 4cqh rgba(0,0,0,.55),inset 0 0 3cqh rgba(255,20,147,.16);}
.qz-kara-lines{font-size:4.2vh;font-size:4.2cqh;line-height:1.14;letter-spacing:.01em;min-height:2.28em;display:flex;align-items:center}
.qz-kara .qz-cap-tag{font-size:2.3cqh;margin-bottom:.8cqh}
.qz-kara-w{display:inline-block;margin-right:.26em;color:rgba(255,255,255,.36);
  -webkit-text-stroke:.12em #1a0526;paint-order:stroke fill;transition:color .12s linear,transform .14s ease-out,text-shadow .14s;}
.qz-kara-w.past{color:#fff}
.qz-kara-w.now{color:#FFD43B;transform:scale(1.09);margin-left:.16em;margin-right:.36em;text-shadow:0 0 .35em rgba(255,212,59,.85),0 .06em 0 #1a0526}
.qz-count-ring{width:23vh;height:23vh;width:23cqh;height:23cqh;border-radius:50%;
  background:radial-gradient(circle at 50% 40%,#3a0f66 0%,#1b0631 62%,#12041f 100%);
  border:1.1cqh solid #FFD43B;
  box-shadow:0 0 0 .6cqh #b36b00,0 0 6cqh rgba(255,184,0,.55),inset 0 0 4cqh rgba(255,20,147,.45);}
.qz-count-bulbs{position:absolute;inset:-1.5cqh;border-radius:50%;
  background:repeating-conic-gradient(from 0deg,#fff4c2 0deg 3deg,transparent 3deg 15deg);
  -webkit-mask:radial-gradient(circle,transparent 63%,#000 64%,#000 69%,transparent 70%);mask:radial-gradient(circle,transparent 63%,#000 64%,#000 69%,transparent 70%);
  filter:drop-shadow(0 0 .8cqh #ffd76a);}
.qz-count-num{font-size:17vh;font-size:17cqh;line-height:1;color:#fff;
  -webkit-text-stroke:.07em #1a0526;paint-order:stroke fill;
  text-shadow:0 .04em 0 #1a0526,0 0 .25em rgba(0,217,255,.75);}
/* telefono in verticale (1080x1920): misure sulla larghezza, didascalie una sopra l'altra */
.qz-portrait .qz-cap-text{font-size:6.6cqw}
.qz-portrait .qz-cap-panel{border-radius:3cqw;padding:2.6cqw 3.6cqw 3cqw;border-width:.9cqw}
.qz-portrait .qz-cap-tag{font-size:3.6cqw;padding:.6cqw 2.4cqw .9cqw;margin-bottom:1.6cqw}
.qz-portrait .qz-ann{font-size:11cqw}
.qz-portrait .qz-final{font-size:15cqw}
.qz-portrait .qz-final-sub{font-size:4.2cqw}
.qz-portrait .qz-rule{width:92cqw;border-radius:3.4cqw;padding:3cqw 3.4cqw;gap:3cqw;border-width:.9cqw}
.qz-portrait .qz-rule-icon{width:17cqw;height:17cqw}
.qz-portrait .qz-rule-body{white-space:normal;font-size:4.6cqw!important;margin-top:1.2cqw}
.qz-portrait .qz-rule-dots{gap:1.2cqw;margin-top:2cqw}
.qz-portrait .qz-rule-dots i{width:2cqw;height:2cqw}
.qz-portrait .qz-kara{width:94cqw;border-radius:3cqw;padding:2.2cqw 3.6cqw 2.8cqw;border-width:.9cqw}
.qz-portrait .qz-kara-lines{font-size:6cqw}
.qz-portrait .qz-kara .qz-cap-tag{font-size:3.4cqw;margin-bottom:1.2cqw}
.qz-portrait .qz-count-ring{width:44cqw;height:44cqw;border-width:2cqw}
.qz-portrait .qz-count-num{font-size:30cqw}
`;

/** In verticale: le didascalie si impilano in alto o in basso, mai ai lati (i personaggi sono al centro). */
const portraitPlacementClass: Record<CaptionDef["placement"], string> = {
  right: "items-start justify-center pt-[7cqh]",
  left: "items-start justify-center pt-[7cqh]",
  top: "items-start justify-center pt-[7cqh]",
  // sopra il pannello "Salta intro" dei telefoni (in basso al centro)
  bottom: "items-end justify-center pb-[22cqh]",
  center: "items-center justify-center",
  topLeft: "items-start justify-center pt-[7cqh]",
  topRight: "items-start justify-center pt-[7cqh]",
  band: "items-start justify-center pt-[24cqh]",
};

const placementClass: Record<CaptionDef["placement"], string> = {
  right: "items-center justify-end pr-[4cqw]",
  left: "items-center justify-start pl-[4cqw]",
  top: "items-start justify-center pt-[5cqh]",
  bottom: "items-end justify-center pb-[8cqh]",
  center: "items-center justify-center",
  topLeft: "items-start justify-start pt-[5cqh] pl-[3cqw]",
  topRight: "items-start justify-end pt-[5cqh] pr-[3cqw]",
  band: "items-start justify-center pt-[38cqh]",
};

function Caption({ def, reducedMotion, portrait }: { def: CaptionDef; reducedMotion: boolean; portrait: boolean }) {
  if (def.id === "final" || def.id === "inizia") {
    return (
      <motion.div
        key={def.id}
        className="flex flex-col items-center"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0.4 } : { type: "spring", stiffness: 260, damping: 14 }}
      >
        <div className="relative">
          <span className="qz-final qz-final-stroke" aria-hidden>
            {def.text}
          </span>
          <span className="qz-final relative">{def.text}</span>
        </div>
      </motion.div>
    );
  }
  const fromX = portrait ? 0 : def.placement === "right" || def.placement === "topRight" ? 120 : def.placement === "left" || def.placement === "topLeft" ? -120 : 0;
  const fromY = portrait ? (def.placement === "bottom" ? 60 : -60) : def.placement === "top" ? -80 : 0;
  return (
    <motion.div
      key={def.id}
      className={portrait ? "qz-cap-panel max-w-[88cqw]" : "qz-cap-panel max-w-[38cqw]"}
      style={{ textAlign: portrait ? "center" : def.placement === "left" || def.placement === "topLeft" ? "left" : def.placement === "right" || def.placement === "topRight" ? "right" : "center" }}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: fromX, y: fromY, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: fromX * 0.5, y: fromY * 0.5, scale: 0.96 }}
      transition={reducedMotion ? { duration: 0.3 } : { type: "spring", stiffness: 320, damping: 26 }}
    >
      {def.tag && (
        <div className="qz-cap-tag" style={{ background: def.accent, boxShadow: `0 0 2.5cqh ${def.accent}` }}>
          {def.tag}
        </div>
      )}
      <div className="qz-cap-text">{def.text}</div>
    </motion.div>
  );
}

export function IntroOverlay({
  state,
  reducedMotion,
  scoring = DEFAULT_SCORING,
  portrait = false,
}: {
  state: IntroTimelineState;
  reducedMotion: boolean;
  scoring?: RulesScoring;
  /** telefono in verticale: didascalie, regole e sottotitoli impilati e misurati sulla larghezza */
  portrait?: boolean;
}) {
  const found = CAPTIONS.find((c) => c.id === state.caption) ?? null;
  // le battute registrate hanno i sottotitoli karaoke al posto della didascalia
  const caption = found && SPOKEN_CAPTIONS.has(found.id) ? null : found;
  useEffect(() => {
    // tempi parola di tutte le battute, in anticipo (file piccoli)
    for (const l of INTRO_SPEECH) if (l.clipWho) void loadWords(wordsUrl(`${INTRO_CLIP_DIR}${l.clip}.mp3`));
    for (const r of RULES) void loadWords(wordsUrl(`${RULES_AUDIO_DIR}${r.file}`));
  }, []);
  const flash = state.flash >= 0 && !reducedMotion ? FLASHES[state.flash] : null;
  const letterbox = state.phase === "blackout";

  return (
    <div className={`qz-intro pointer-events-none absolute inset-0 select-none overflow-hidden${portrait ? " qz-portrait" : ""}`} aria-live="polite">
      {/* vignettatura per profondità e leggibilità */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(5,0,12,0.55) 100%)" }} />

      {/* bande cinema durante il blackout */}
      <motion.div
        className="absolute inset-x-0 top-0 bg-black"
        initial={false}
        animate={{ height: letterbox ? "11%" : "0%" }}
        transition={{ duration: reducedMotion ? 0.2 : 0.9, ease: [0.7, 0, 0.2, 1] }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-black"
        initial={false}
        animate={{ height: letterbox ? "11%" : "0%" }}
        transition={{ duration: reducedMotion ? 0.2 : 0.9, ease: [0.7, 0, 0.2, 1] }}
      />

      {/* didascalie */}
      <AnimatePresence mode="wait">
        {caption && (
          <div key={caption.id} className={`absolute inset-0 flex ${(portrait ? portraitPlacementClass : placementClass)[caption.placement]}`}>
            <Caption def={caption} reducedMotion={reducedMotion} portrait={portrait} />
          </div>
        )}
      </AnimatePresence>

      {/* scheda della regola in corso: sopra la testa di chi parla, mai sui personaggi */}
      <AnimatePresence mode="wait">
        {state.rule !== null && <RuleCard key={state.rule} index={state.rule} scoring={scoring} reducedMotion={reducedMotion} portrait={portrait} />}
      </AnimatePresence>

      {/* sottotitoli karaoke dal lato opposto a chi parla (sotto la scheda della regola, se c'è) */}
      <AnimatePresence mode="wait">
        {state.line && <Karaoke key={state.line.key} line={state.line} t={state.lineT} belowCard={state.rule !== null} reducedMotion={reducedMotion} portrait={portrait} />}
      </AnimatePresence>

      {/* countdown */}
      <AnimatePresence>
        {state.countdown !== null && (
          <motion.div
            key="ring"
            className="absolute inset-x-0 flex justify-center"
            style={{ top: "32%" }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="qz-count-ring relative flex items-center justify-center">
              <div className="qz-count-bulbs" />
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={state.countdown}
                  className="qz-count-num absolute"
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 2.2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                  transition={reducedMotion ? { duration: 0.2 } : { type: "spring", stiffness: 420, damping: 18 }}
                >
                  {state.countdown}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* lampi (mai con reducedMotion) */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={`flash-${state.flash}`}
            className="absolute inset-0"
            style={{ background: flash.color, mixBlendMode: "screen" }}
            initial={{ opacity: 0.75 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const SPEAKER_ACCENT = { professore: "#087CFF", regina: "#FF1493", palmino: "#00D46A" } as const;
const SPEAKER_TAG = { professore: "IL PROFESSORE", regina: "LA REGINA", palmino: "PALMINO" } as const;

/**
 * Sottotitoli "karaoke": la battuta a blocchi di 2–3 righe, la parola in corso evidenziata
 * (giallo, leggero ingrandimento e alone), quelle già dette piene, le prossime attenuate.
 * Sempre in basso al centro, per tutti e tre i presentatori.
 */
function Karaoke({ line, t, belowCard, reducedMotion, portrait }: { line: SpokenLine; t: number; belowCard: boolean; reducedMotion: boolean; portrait: boolean }) {
  const url = wordsUrl(line.clip);
  const [loaded, setLoaded] = useState(() => cachedWords(url));
  useEffect(() => {
    let alive = true;
    if (loaded === undefined)
      void loadWords(url).then((w) => {
        if (alive) setLoaded(w);
      });
    return () => {
      alive = false;
    };
  }, [url, loaded]);
  const words = wordsFor(line.text, line.dur, loaded);
  const now = wordIndexAt(words, t);
  // pannello largo in basso al centro: blocchi da ~2 righe
  const starts = chunkStarts(words, portrait ? 64 : 96);
  let chunk = 0;
  for (let c = 0; c < starts.length; c++) if (starts[c] <= Math.max(0, now)) chunk = c;
  const from = starts[chunk];
  const to = starts[chunk + 1] ?? words.length;
  const accent = SPEAKER_ACCENT[line.who];
  return (
    <div className={`absolute inset-0 flex items-end justify-center ${portrait ? "pb-[19cqh]" : "pb-[4cqh]"}`}>
      <motion.div
        className="qz-kara"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        transition={reducedMotion ? { duration: 0.25 } : { type: "spring", stiffness: 320, damping: 28 }}
      >
        {!belowCard && (
          <div className="qz-cap-tag" style={{ background: accent, boxShadow: `0 0 2.5cqh ${accent}` }}>
            {SPEAKER_TAG[line.who]}
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={chunk}
            className="qz-kara-lines"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.22 }}
          >
            <div style={{ textAlign: "center", width: "100%" }}>
              {words.slice(from, to).map((w, k) => {
                const i = from + k;
                const cls = i < now || (i === now && t > w.end + 0.35) ? "past" : i === now ? "now" : "";
                return (
                  <span key={i} className={`qz-kara-w ${cls}`}>
                    {w.w}
                  </span>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/** Icone semplici e leggibili da lontano (tratto bianco spesso). */
function RuleIconSvg({ icon }: { icon: RuleIcon }) {
  const common = { fill: "none", stroke: "#fff", strokeWidth: 3.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<RuleIcon, React.ReactNode> = {
    book: (
      <>
        <path d="M6 9c4-2 8-2 12 0v24c-4-2-8-2-12 0z" {...common} />
        <path d="M18 9c4-2 8-2 12 0v24c-4-2-8-2-12 0z" {...common} />
      </>
    ),
    phone: (
      <>
        <rect x="11" y="4" width="14" height="28" rx="3" {...common} />
        <path d="M16 27h4" {...common} />
      </>
    ),
    timer: (
      <>
        <circle cx="18" cy="20" r="11" {...common} />
        <path d="M18 20V13M15 4h6M18 4v5" {...common} />
      </>
    ),
    points: (
      <>
        <path d="M5 12h8M9 8v8" {...common} />
        <path d="M23 12h8" {...common} />
        <circle cx="18" cy="25" r="7" {...common} />
        <path d="M18 21v8" {...common} />
      </>
    ),
    multi: (
      <>
        <rect x="5" y="6" width="9" height="9" rx="2" {...common} />
        <rect x="5" y="21" width="9" height="9" rx="2" {...common} />
        <path d="M7 10l2 2 4-4M7 25l2 2 4-4M19 10h12M19 26h12" {...common} />
      </>
    ),
    gift: (
      <>
        <rect x="6" y="14" width="24" height="17" rx="2" {...common} />
        <path d="M4 14h28M18 14v17M18 14c-3-6-10-6-8-1M18 14c3-6 10-6 8-1" {...common} />
      </>
    ),
    vote: (
      <>
        <rect x="6" y="18" width="24" height="13" rx="2" {...common} />
        <path d="M13 18l4-12 7 3-3 9M12 24h12" {...common} />
      </>
    ),
    trophy: (
      <>
        <path d="M11 5h14v8a7 7 0 0 1-14 0z" {...common} />
        <path d="M11 8H6c0 5 3 7 5 7M25 8h5c0 5-3 7-5 7M18 20v6M12 31h12M14 26h8" {...common} />
      </>
    ),
    fair: (
      <>
        <path d="M18 4l11 4v9c0 8-5 12-11 15-6-3-11-7-11-15V8z" {...common} />
        <path d="M13 18l4 4 7-8" {...common} />
      </>
    ),
    go: (
      <>
        <path d="M8 31V5M8 6c6-3 10 3 18 0v12c-8 3-12-3-18 0" {...common} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 36 36" width="60%" height="60%" aria-hidden>
      {paths[icon]}
    </svg>
  );
}

/**
 * Corpo del testo che sta sempre su UNA riga: al massimo `maxCqh`, altrimenti rimpicciolito
 * perché entri nei ~27cqw disponibili nella scheda (em medio Lilita ≈ `em` × corpo).
 */
function fitFont(text: string, maxCqh: number, em: number, portrait = false): string {
  // in verticale la scheda è larga quasi tutto lo schermo: ~62cqw per il testo, corpo massimo sulla larghezza
  const fit = (portrait ? 62 : 27) / Math.max(1, text.length * em);
  return portrait ? `min(${(maxCqh * 1.45).toFixed(2)}cqw, ${fit.toFixed(2)}cqw)` : `min(${maxCqh}cqh, ${fit.toFixed(2)}cqw)`;
}

function RuleCard({ index, scoring, reducedMotion, portrait }: { index: number; scoring: RulesScoring; reducedMotion: boolean; portrait: boolean }) {
  const rule = RULES[index];
  const body = ruleBody(rule, scoring);
  const accent = SPEAKER_ACCENT[rule.who];
  // dal lato OPPOSTO a chi parla (la camera stringe su di lui): Professore → destra, Regina → sinistra
  const right = rule.who !== "regina";
  return (
    <div className={`absolute inset-0 flex items-start ${portrait ? "justify-center pt-[6cqh]" : `${right ? "justify-end pr-[3cqw]" : "justify-start pl-[3cqw]"} pt-[5cqh]`}`}>
      <motion.div
        className="qz-rule"
        initial={reducedMotion ? { opacity: 0 } : portrait ? { opacity: 0, y: -60, scale: 0.92 } : { opacity: 0, x: right ? 140 : -140, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : portrait ? { opacity: 0, y: -30, scale: 0.96 } : { opacity: 0, x: right ? 80 : -80, scale: 0.95 }}
        transition={reducedMotion ? { duration: 0.25 } : { type: "spring", stiffness: 320, damping: 26 }}
      >
        <div className="qz-rule-icon" style={{ background: `radial-gradient(circle at 35% 30%, ${accent}, #1a0526 120%)`, color: accent }}>
          <RuleIconSvg icon={rule.icon} />
        </div>
        <div className="min-w-0">
          <div className="qz-rule-title" style={{ fontSize: fitFont(rule.title, 5.4, 0.6, portrait) }}>
            {rule.title}
          </div>
          <div className="qz-rule-body" style={{ fontSize: fitFont(body, 3.9, 0.53, portrait) }}>
            {body}
          </div>
          <div className="qz-rule-dots">
            {RULES.map((_, i) => (
              <i key={i} className={i <= index ? "on" : undefined} />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

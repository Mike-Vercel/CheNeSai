"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArenaProps, ArenaTeam } from "../../arena-contract";
import { HOST_MODELS } from "../characters/host-models";
import { TIG, displayCase, inkOn } from "../palette";
import { Mascot2DGlyph } from "../mascot/Mascot2D";
import { normalizeSafeArea } from "./camera-math";
import { awardsRevealed, directArena } from "./director";
import { columnHeight, podLayout, POD, scoreScale } from "./layout";
import { GAME_MOTTO, GAME_NAME, isGameName } from "./led-texture";
import { rankOrder, tableOrder } from "./rank-anim";
import "./arena-2d.css";

/**
 * ARENA 2D (qualità "2d": niente WebGL, renderer software o movimento ridotto; anche come anteprima mentre il 3D si
 * carica) di TAVERNA DEI PIRATI (ex TAVOLI IN GUERRA!): la taverna sul molo in SVG/CSS con le stesse informazioni dell'arena 3D — la grande
 * VELA con titolo/classifica (mappa del tesoro)/allarme (vela rossa)/sfida/premiazione (casse), il ponte di comando
 * col timone, le postazioni delle ciurme sulla U (tamburo, PILA DI DOBLONI alta quanto il punteggio, stendardo col
 * colore e il numero del tavolo, punti, Energia Caos, doblone segnaposto della mascotte), la baia di notte con la
 * luna e il galeone. I presentatori sono targhette (dichiaratamente 2D, non il personaggio). Inquadrata dentro la
 * finestra libera dall'HUD (safeArea). Con più di 14 squadre le postazioni stanno su due file come nel 3D.
 */

const W = 1600;
const H = 900;
const INK = "#21160e";
const OCHRE = "#9a2e1c";
const FONT_TITLE = "var(--font-tig-display), 'Pirata One', Georgia, serif";

/** Scala della pianta (pixel SVG per metro). */
function planScale(radius: number) {
  return 640 / Math.max(6.5, radius + 1.2);
}

function podScreen(x: number, z: number, radius: number, backRow: boolean) {
  const k = planScale(radius);
  return { sx: W / 2 + x * k, sy: 712 + z * k * 0.3 - (backRow ? 110 : 0), depth: z };
}

/** Nome sotto la postazione: al massimo `max` caratteri (le postazioni vicine non si sovrappongono), «…» se tagliato. */
function shortName(name: string, max: number): string {
  const n = name.toUpperCase();
  return n.length <= max ? n : `${n.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Sigillo di ceralacca (posizione), il primo è un doblone. */
function Seal({ x, y, r, n, gold }: { x: number; y: number; r: number; n: number; gold: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={gold ? TIG.gold : "#8e1f18"} stroke={gold ? "#7a4f10" : "#5e130e"} strokeWidth={3} />
      <text x={x} y={y + r * 0.38} textAnchor="middle" className="tig2d-small" fill={gold ? "#4a2c06" : "#f6ead2"}>
        {n}
      </text>
    </g>
  );
}

function LedPanel({ props, mode, teams, awardsShown }: { props: ArenaProps; mode: string; teams: ArenaTeam[]; awardsShown: number }) {
  const title = props.title?.toUpperCase();
  const sub = props.subtitle?.toUpperCase();
  const focus = (props.spotlight?.teamIds ?? []).map((id) => teams.find((t) => t.teamId === id)).filter((t): t is ArenaTeam => !!t);
  const ranked = rankOrder(teams);
  const max = scoreScale(Math.max(0, ...teams.map((t) => t.score)));
  const x = W / 2 - 520;
  const y = 40;
  const w = 1040;
  const h = 270;
  const red = mode === "alarm";
  let body: React.ReactNode;
  switch (mode) {
    case "ambient":
      // l'HUD della pagina occupa il centro: la vela non porta testo, solo la rosa dei venti
      body = (
        <g opacity={0.28} fill={INK}>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const r = i % 2 ? 50 : 90;
            const cx = W / 2;
            const cy = y + h / 2;
            return <polygon key={i} points={`${cx},${cy} ${cx + Math.cos(a - 0.25) * 18},${cy + Math.sin(a - 0.25) * 18} ${cx + Math.cos(a) * r},${cy + Math.sin(a) * r} ${cx + Math.cos(a + 0.25) * 18},${cy + Math.sin(a + 0.25) * 18}`} />;
          })}
        </g>
      );
      break;
    case "leaderboard": {
      const rows = ranked.slice(0, 6);
      body = (
        <g>
          <text x={W / 2} y={y + 52} className="tig2d-led-head" fill={INK} style={{ fontFamily: FONT_TITLE }}>
            {displayCase(props.title ?? "Classifica")}
          </text>
          {rows.map((t, i) => {
            const ry = y + 74 + i * 31;
            const bw = Math.max(8, (t.score / max) * 520);
            return (
              <g key={t.teamId}>
                <Seal x={x + 70} y={ry + 13} r={13} n={t.rank} gold={t.rank === 1} />
                <polygon points={`${x + 94},${ry} ${x + 138},${ry} ${x + 130},${ry + 13} ${x + 138},${ry + 26} ${x + 94},${ry + 26}`} fill={t.color} stroke="rgba(33,22,14,0.5)" />
                <text x={x + 113} y={ry + 20} className="tig2d-small" textAnchor="middle" fill={inkOn(t.color)}>
                  {t.tableNo}
                </text>
                <text x={x + 152} y={ry + 19} className="tig2d-small" fill={INK}>
                  {t.name.toUpperCase().slice(0, 22)}
                </text>
                <line x1={x + 420} y1={ry + 13} x2={x + 420 + bw} y2={ry + 13} stroke={t.rank === 1 ? OCHRE : "rgba(33,22,14,0.55)"} strokeWidth={4} strokeDasharray="10 7" className="tig2d-bar" />
                <circle cx={x + w - 34} cy={ry + 13} r={9} fill={TIG.gold} stroke="#7a4f10" strokeWidth={2} />
                <text x={x + w - 52} y={ry + 20} className="tig2d-small" textAnchor="end" fill={t.rank === 1 ? OCHRE : INK}>
                  {t.score.toLocaleString("it-IT")}
                </text>
              </g>
            );
          })}
        </g>
      );
      break;
    }
    case "alarm":
      body = (
        <g>
          <text x={W / 2} y={y + 158} className="tig2d-led-title tig2d-alarm" fill="#f6ead2" style={{ fontFamily: FONT_TITLE }}>
            {displayCase(props.title ?? "Allarme Caos!")}
          </text>
          <text x={W / 2} y={y + 224} className="tig2d-led-sub" fill="#f6ead2">
            {sub ?? (focus.length >= 2 ? `TAVOLO ${focus[0].tableNo} ⚔ TAVOLO ${focus[1].tableNo}` : "SFIDA SPECIALE · 45 SECONDI")}
          </text>
        </g>
      );
      break;
    case "vs":
      body = (
        <g>
          <text x={W / 2} y={y + 54} className="tig2d-led-head" fill={INK} style={{ fontFamily: FONT_TITLE }}>
            {displayCase(props.title ?? "Sfida")}
          </text>
          {focus.slice(0, 2).map((t, i) => {
            const cx = i ? W / 2 + 270 : W / 2 - 270;
            return (
              <g key={t.teamId}>
                {/* due navi: scafo, albero, vela del colore della ciurma */}
                <path d={`M ${cx - 90} ${y + 150} L ${cx + 90} ${y + 150} L ${cx + 70} ${y + 178} L ${cx - 70} ${y + 178} Z`} fill="#3a2414" />
                <rect x={cx - 3} y={y + 70} width={6} height={82} fill="#2a190d" />
                <path d={`M ${cx - 48} ${y + 78} Q ${cx} ${y + 92} ${cx + 48} ${y + 78} L ${cx + 54} ${y + 136} Q ${cx} ${y + 148} ${cx - 54} ${y + 136} Z`} fill={t.color} stroke="rgba(33,22,14,0.55)" strokeWidth={2} />
                <text x={cx} y={y + 212} className="tig2d-led-sub" fill={INK}>
                  TAVOLO {t.tableNo}
                </text>
                <text x={cx} y={y + 246} className="tig2d-small" textAnchor="middle" fill={INK}>
                  {t.name.toUpperCase().slice(0, 24)}
                </text>
              </g>
            );
          })}
          <text x={W / 2} y={y + 170} className="tig2d-led-title" fill={OCHRE}>
            VS
          </text>
        </g>
      );
      break;
    case "awards": {
      const order = [2, 1, 3];
      body = (
        <g>
          <text x={W / 2} y={y + 52} className="tig2d-led-head" fill={INK} style={{ fontFamily: FONT_TITLE }}>
            {displayCase(props.title ?? "Premiazione")}
          </text>
          {order.map((place, i) => {
            const t = ranked[place - 1];
            const shown = awardsShown >= 4 - place;
            const ph = place === 1 ? 150 : place === 2 ? 115 : 90;
            const px = W / 2 + (i - 1) * 230 - 100;
            return (
              <g key={place}>
                {/* cassa di legno */}
                <rect x={px} y={y + h - 20 - ph} width={200} height={ph} rx={4} fill="#6b4628" stroke="#2a2420" strokeWidth={5} />
                {shown && t && <rect x={px + 10} y={y + h - 14 - ph} width={180} height={12} fill={t.color} />}
                <text x={px + 100} y={y + h - ph + 30} className="tig2d-led-sub" fill={place === 1 ? TIG.goldLight : "#f6ead2"}>
                  {place}°
                </text>
                <text x={px + 100} y={y + h - ph - 30} className="tig2d-small" textAnchor="middle" fill={INK}>
                  {shown && t ? t.name.toUpperCase().slice(0, 18) : "?"}
                </text>
              </g>
            );
          })}
        </g>
      );
      break;
    }
    default: {
      const t0 = props.title ?? null;
      const big = displayCase(mode === "logo" ? GAME_NAME : mode === "break" ? (t0 ?? "Pausa") : mode === "final" ? (t0 ?? "Tutto o Niente!") : mode === "evolve" ? (t0 ?? "Evoluzione!") : (t0 ?? GAME_NAME));
      const over = mode === "manche" || (mode === "title" && props.mancheNo) ? `MANCHE ${props.mancheNo ?? ""}` : null;
      const own = title && !isGameName(title) ? title : null;
      const small = mode === "logo" ? (own ?? sub ?? GAME_MOTTO).toUpperCase() : mode === "evolve" && focus[0] ? `TAVOLO ${focus[0].tableNo} · LIVELLO ${focus[0].mascotLevel}` : sub;
      const tone = mode === "final" ? OCHRE : mode === "evolve" ? "#5a3a08" : mode === "break" ? "#1d2a3a" : INK;
      body = (
        <g>
          {over && (
            <text x={W / 2} y={y + 64} className="tig2d-led-head" fill={OCHRE}>
              {over}
            </text>
          )}
          <text x={W / 2} y={y + 168} className="tig2d-led-title" fill={tone} style={{ fontFamily: FONT_TITLE }}>
            {big}
          </text>
          {small && (
            <text x={W / 2} y={y + 230} className="tig2d-led-sub" fill="rgba(33,22,14,0.7)">
              {small}
            </text>
          )}
        </g>
      );
    }
  }
  // vela: trapezio con la pancia in basso, appesa al pennone dell'albero maestro
  const sail = `M ${x} ${y} L ${x + w} ${y} L ${x + w + 18} ${y + h} Q ${W / 2} ${y + h + 34} ${x - 18} ${y + h} Z`;
  return (
    <g>
      <rect x={W / 2 - 7} y={0} width={14} height={y + h + 120} fill="#3b2414" />
      <rect x={x - 40} y={y - 14} width={w + 80} height={14} rx={7} fill="#4a2e18" />
      <path d={sail} fill={red ? "url(#tig2d-sail-red)" : mode === "break" ? "url(#tig2d-sail-night)" : "url(#tig2d-sail)"} stroke={red ? "#5a120c" : "#9c8457"} strokeWidth={5} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={x + ((i + 1) * w) / 10} y1={y + 4} x2={x + ((i + 1) * w) / 10} y2={y + h + 10} stroke={red ? "rgba(30,4,2,0.25)" : "rgba(80,55,28,0.18)"} strokeWidth={3} />
      ))}
      {body}
    </g>
  );
}

export default function Arena2D(props: ArenaProps) {
  const teams = useMemo(() => tableOrder(props.teams), [props.teams]);
  const layout = useMemo(() => podLayout(teams.length), [teams.length]);
  // inizio della fase: dall'orologio del server se la pagina lo passa (come l'arena 3D)
  const phaseKey = `${props.phase}|${props.phaseStartedAt ?? ""}`;
  const [since, setSince] = useState(() => ({ key: phaseKey, at: props.phaseStartedAt ?? props.now() }));
  if (since.key !== phaseKey) setSince({ key: phaseKey, at: props.phaseStartedAt ?? props.now() });
  // battito (2 al secondo) per le scene a tempo: intro, premiazione
  const [, setTick] = useState(0);
  const timed = props.phase === "awards" || props.phase === "intro" || props.phase === "manche-intro" || props.phase === "reveal";
  useEffect(() => {
    if (!timed) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [timed]);
  const elapsed = Math.max(0, props.now() - since.at);
  const dir0 = directArena({ phase: props.phase, elapsedMs: elapsed, spotlight: props.spotlight, spotAgeMs: 0, speaking: false, hostCount: props.hosts.length, teamCount: teams.length });
  const dir = props.ledwall === "ambient" ? { ...dir0, led: "ambient" as const } : dir0;
  const scale = scoreScale(Math.max(0, ...teams.map((t) => t.score)));
  const win = normalizeSafeArea(props.safeArea);
  const focus = new Set(props.spotlight?.teamIds ?? []);
  const readyCb = useRef(props.onReady);
  useEffect(() => {
    readyCb.current = props.onReady;
  });
  useEffect(() => {
    readyCb.current?.();
  }, []);
  const awardsShown = props.phase === "awards" ? awardsRevealed(elapsed, teams.length) : 0;
  const twoRows = layout.rows === 2;
  const pods = layout.pods
    .map((p, i) => ({ p, t: teams[i], s: podScreen(p.x, p.z, layout.radius, twoRows && p.row === 1) }))
    .filter((x) => x.t)
    .sort((a, b) => a.s.depth - b.s.depth);
  const towerScale = (twoRows ? 90 : 118) / (POD.maxHeight - POD.minHeight + 0.6);
  // due file: tra una postazione e la vicina (dell'altra fila) c'è mezzo passo
  const podW = twoRows ? Math.max(40, Math.min(70, ((layout.spacing * planScale(layout.radius)) / 2) * 0.95)) : Math.max(46, Math.min(96, 1100 / Math.max(1, teams.length)));
  const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: (Math.sin(i * 12.9898) * 43758.5453) % 1, y: (Math.sin(i * 78.233) * 12345.678) % 1, r: 0.8 + (i % 3) * 0.5 })), []);

  return (
    <div className={`tig2d ${props.className ?? ""}`} data-mood={dir.mood}>
      <div
        className="tig2d-frame"
        style={{ left: `${win.x0 * 100}%`, top: `${win.y0 * 100}%`, width: `${(win.x1 - win.x0) * 100}%`, height: `${(win.y1 - win.y0) * 100}%` }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Arena di ${GAME_NAME}: ${props.title ?? props.phase}`}>
          <defs>
            <linearGradient id="tig2d-sail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d9c69c" />
              <stop offset="0.6" stopColor="#f2e5c6" />
              <stop offset="1" stopColor="#e2cfa4" />
            </linearGradient>
            <linearGradient id="tig2d-sail-red" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7a1a12" />
              <stop offset="0.6" stopColor="#a82e20" />
              <stop offset="1" stopColor="#8a2218" />
            </linearGradient>
            <linearGradient id="tig2d-sail-night" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a8a291" />
              <stop offset="1" stopColor="#c9c2ae" />
            </linearGradient>
            <linearGradient id="tig2d-sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#123643" />
              <stop offset="1" stopColor="#07131a" />
            </linearGradient>
            <radialGradient id="tig2d-moon">
              <stop offset="0" stopColor="#f4f7ff" />
              <stop offset="0.7" stopColor="#dfe8ff" />
              <stop offset="1" stopColor="#9fb4e0" />
            </radialGradient>
            <radialGradient id="tig2d-halo">
              <stop offset="0" stopColor="#9fb4e0" stopOpacity="0.35" />
              <stop offset="1" stopColor="#9fb4e0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="tig2d-coins" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#9b6716" />
              <stop offset="0.45" stopColor="#ffe08a" />
              <stop offset="1" stopColor="#a8701c" />
            </linearGradient>
            <pattern id="tig2d-stack" width="10" height="7" patternUnits="userSpaceOnUse">
              <rect width="10" height="7" fill="url(#tig2d-coins)" />
              <rect y="5.6" width="10" height="1.4" fill="rgba(90,55,10,0.65)" />
            </pattern>
            <radialGradient id="tig2d-deck" cx="0.5" cy="0.5" r="0.6">
              <stop offset="0" stopColor="#6b4628" />
              <stop offset="1" stopColor="#3b2414" />
            </radialGradient>
          </defs>
          {/* cielo, stelle, luna */}
          {stars.map((s, i) => (
            <circle key={i} cx={Math.abs(s.x) * W} cy={Math.abs(s.y) * 330} r={s.r} fill="#e8eeff" opacity={0.55} />
          ))}
          <circle cx={180} cy={120} r={120} fill="url(#tig2d-halo)" />
          <circle cx={180} cy={120} r={42} fill="url(#tig2d-moon)" />
          {/* mare con la scia della luna */}
          <rect x={0} y={330} width={W} height={H - 330} fill="url(#tig2d-sea)" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={150 - i * 6} y1={350 + i * 14} x2={210 + i * 8} y2={350 + i * 14} stroke="#cfdcff" strokeOpacity={0.35 - i * 0.03} strokeWidth={3} strokeLinecap="round" />
          ))}
          {/* galeone all'ancora (sagoma) e palme */}
          <g transform="translate(1290, 300)" opacity={0.9}>
            <path d="M -150 30 L 160 30 L 130 70 L -120 70 Z" fill="#160f0a" />
            <rect x={-150} y={2} width={60} height={30} fill="#160f0a" />
            {[-80, 0, 80].map((mx) => (
              <rect key={mx} x={mx - 3} y={-150} width={6} height={182} fill="#1d140d" />
            ))}
            {[-112, -96].map((wx) => (
              <rect key={wx} x={wx} y={12} width={10} height={9} fill="#ffb35a" />
            ))}
            <circle cx={-150} cy={0} r={6} fill="#ffcf6a" />
          </g>
          <g fill="#0d1a14">
            <path d="M 60 470 Q 70 380 96 300 L 104 302 Q 82 384 74 470 Z" />
            <path d="M 100 300 q -60 -10 -90 30 q 40 -18 90 -24 q -30 -40 -84 -40 q 56 4 92 32 q 10 -50 60 -64 q -36 26 -50 66 q 60 -14 96 10 q -50 -6 -104 0 Z" />
          </g>
          <LedPanel props={props} mode={dir.led} teams={teams} awardsShown={awardsShown} />
          {/* molo di tavole e rosa dei venti */}
          <ellipse cx={W / 2} cy={660} rx={760} ry={250} fill="#4a2f1b" />
          <ellipse cx={W / 2} cy={660} rx={760} ry={250} fill="url(#tig2d-deck)" opacity={0.85} />
          <ellipse cx={W / 2} cy={660} rx={520} ry={150} fill="none" stroke={TIG.gold} strokeOpacity={0.25} strokeDasharray="10 12" strokeWidth={3} />
          {/* ponte di comando (più in basso, davanti alle postazioni del fondo) */}
          <g transform="translate(0, 110)">
            <polygon points={`${W / 2 - 230},610 ${W / 2 - 120},560 ${W / 2 + 120},560 ${W / 2 + 230},610 ${W / 2 + 120},660 ${W / 2 - 120},660`} fill="#5a3a22" stroke={TIG.brass} strokeWidth={4} />
            {/* timone */}
            <g transform={`translate(${W / 2 - 150}, 560)`} stroke="#3b2414" strokeWidth={5} fill="none">
              <circle r={22} />
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k / 8) * Math.PI * 2;
                return <line key={k} x1={0} y1={0} x2={Math.cos(a) * 32} y2={Math.sin(a) * 32} />;
              })}
            </g>
            {props.hosts.slice(0, 4).map((hh, i, arr) => {
              const hx = W / 2 + (i - (arr.length - 1) / 2) * 150;
              const info = HOST_MODELS[hh.who];
              return (
                <g key={`${hh.who}-${i}`} className={hh.speaking ? "tig2d-host tig2d-speaking" : "tig2d-host"}>
                  <rect x={hx - 66} y={572} width={132} height={44} rx={22} fill="#2a1a0e" stroke={info.tint} strokeWidth={2.5} />
                  <circle cx={hx - 44} cy={594} r={10} fill={info.tint} />
                  <text x={hx + 6} y={601} className="tig2d-small" textAnchor="middle" fill="#f6ead2">
                    {info.name.split(" (")[0].toUpperCase().slice(0, 12)}
                  </text>
                </g>
              );
            })}
          </g>
          {/* postazioni delle ciurme */}
          {pods.map(({ t, s }) => {
            const hgt = columnHeight(t.score, scale) * towerScale;
            const dimmed = (dir.mood === "duel" || dir.mood === "chaos") && !focus.has(t.teamId);
            const lit = focus.has(t.teamId);
            const col = t.online ? t.color : "#5b5f63";
            const topY = s.sy - hgt;
            const r = podW * 0.42;
            const arc = 2 * Math.PI * (r + 6);
            const sw = podW * 0.5;
            return (
              <g key={t.teamId} className={`tig2d-pod${dimmed ? " tig2d-dim" : ""}${lit ? " tig2d-lit" : ""}${t.online ? "" : " tig2d-off"}`}>
                <ellipse cx={s.sx} cy={s.sy + 6} rx={podW * 0.62} ry={podW * 0.18} fill={TIG.amber} opacity={0.18} />
                {/* stendardo su un'asta, a sinistra della pila */}
                <rect x={s.sx - podW * 0.62} y={s.sy - 104} width={3} height={104} fill="#4a3020" />
                <path d={`M ${s.sx - podW * 0.62 + 3} ${s.sy - 102} h ${podW * 0.38} v ${44} l ${-podW * 0.19} ${-10} l ${-podW * 0.19} ${10} Z`} fill={col} stroke="rgba(246,234,210,0.8)" strokeWidth={1.5} />
                {/* tamburo e pila di dobloni */}
                <rect x={s.sx - podW * 0.4} y={s.sy - 12} width={podW * 0.8} height={14} rx={4} fill="#6b4628" stroke={TIG.brass} strokeWidth={2} />
                <rect x={s.sx - sw / 2} y={topY} width={sw} height={Math.max(0, hgt - 12)} fill="url(#tig2d-stack)" className="tig2d-tower" />
                <ellipse cx={s.sx} cy={topY} rx={sw / 2 + 3} ry={4} fill="#ffe08a" stroke="#7a4f10" strokeWidth={1.5} />
                {/* Energia Caos */}
                <circle cx={s.sx} cy={topY - r - 4} r={r + 6} fill="none" stroke={TIG.chaos} strokeOpacity={0.22} strokeWidth={4} />
                <circle cx={s.sx} cy={topY - r - 4} r={r + 6} fill="none" stroke={TIG.chaos} strokeWidth={4} strokeDasharray={`${arc * Math.min(1, t.chaosProgress)} ${arc}`} transform={`rotate(-90 ${s.sx} ${topY - r - 4})`} />
                <foreignObject x={s.sx - r} y={topY - 2 * r - 4} width={2 * r} height={2 * r}>
                  <Mascot2DGlyph slot={t.mascotSlot} level={t.mascotLevel} color={col} />
                </foreignObject>
                {/* targa col numero del tavolo */}
                <rect x={s.sx - podW * 0.5} y={topY - 2 * r - 58} width={podW} height={30} rx={6} fill="#4a2e18" stroke={TIG.brass} strokeWidth={2} />
                <rect x={s.sx - podW * 0.5 + 4} y={topY - 2 * r - 54} width={26} height={22} rx={4} fill={col} />
                <text x={s.sx + 10} y={topY - 2 * r - 36} className="tig2d-num" textAnchor="middle" fill="#f6ead2">
                  {t.tableNo}
                </text>
                <text x={s.sx} y={s.sy + 30} className="tig2d-score" textAnchor="middle" fill={t.rank === 1 && t.score > 0 ? TIG.goldLight : "#f6ead2"}>
                  {t.score.toLocaleString("it-IT")}
                </text>
                <text x={s.sx} y={s.sy + 52} className="tig2d-name" textAnchor="middle" fill="#e6d8bb">
                  {t.online ? shortName(t.name, Math.max(6, Math.floor(podW / 10))) : "OFFLINE"}
                </text>
                <text x={s.sx - podW * 0.43} y={s.sy - 80} className="tig2d-flagnum" textAnchor="middle" fill={inkOn(col)}>
                  {t.tableNo}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

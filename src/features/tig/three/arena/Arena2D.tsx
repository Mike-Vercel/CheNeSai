"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArenaProps, ArenaTeam } from "../../arena-contract";
import { HOST_MODELS } from "../characters/host-models";
import { TIG, inkOn } from "../palette";
import { Mascot2DGlyph } from "../mascot/Mascot2D";
import { normalizeSafeArea } from "./camera-math";
import { awardsRevealed, directArena } from "./director";
import { columnHeight, podLayout, POD, scoreScale } from "./layout";
import { rankOrder, tableOrder } from "./rank-anim";
import "./arena-2d.css";

/**
 * ARENA 2D (qualità "2d": niente WebGL, renderer software o movimento ridotto; anche come anteprima mentre il 3D si
 * carica). Stesse informazioni dell'arena 3D in SVG/CSS: schermo con titolo/classifica/allarme/sfida, palco, torri
 * delle squadre sull'arco (altezza = punteggio, numero, nome, punti, Energia Caos, mascotte), presentatori come
 * targhette (dichiaratamente 2D, non il personaggio). Inquadrata dentro la finestra libera dall'HUD (safeArea).
 */

const W = 1600;
const H = 900;

function podScreen(x: number, z: number, radius: number) {
  const k = 640 / Math.max(6.5, radius + 1.2);
  return { sx: W / 2 + x * k, sy: 700 + z * k * 0.3, depth: z };
}

function LedPanel({ props, mode, teams, awardsShown }: { props: ArenaProps; mode: string; teams: ArenaTeam[]; awardsShown: number }) {
  const title = props.title?.toUpperCase();
  const sub = props.subtitle?.toUpperCase();
  const focus = (props.spotlight?.teamIds ?? []).map((id) => teams.find((t) => t.teamId === id)).filter((t): t is ArenaTeam => !!t);
  const ranked = rankOrder(teams);
  const max = scoreScale(Math.max(0, ...teams.map((t) => t.score)));
  const x = W / 2 - 520;
  const y = 28;
  const w = 1040;
  const h = 250;
  let body: React.ReactNode;
  switch (mode) {
    case "leaderboard": {
      const rows = ranked.slice(0, 6);
      body = (
        <g>
          <text x={W / 2} y={y + 44} className="tig2d-led-head" fill={TIG.gold}>
            {title ?? "CLASSIFICA"}
          </text>
          {rows.map((t, i) => {
            const ry = y + 66 + i * 32;
            const bw = Math.max(6, (t.score / max) * 560);
            return (
              <g key={t.teamId} className="tig2d-row" style={{ transform: `translateY(${0}px)` }}>
                <rect x={x + 40} y={ry} width={34} height={26} rx={5} fill={t.rank === 1 ? TIG.gold : "rgba(255,255,255,0.14)"} />
                <text x={x + 57} y={ry + 20} className="tig2d-small" textAnchor="middle" fill={t.rank === 1 ? "#1a1204" : "#fff"}>
                  {t.rank}
                </text>
                <rect x={x + 82} y={ry} width={34} height={26} rx={5} fill={t.color} />
                <text x={x + 99} y={ry + 20} className="tig2d-small" textAnchor="middle" fill={inkOn(t.color)}>
                  {t.tableNo}
                </text>
                <rect x={x + 128} y={ry + 4} width={bw} height={18} rx={4} fill={t.color} opacity={0.75} className="tig2d-bar" />
                <text x={x + 136} y={ry + 19} className="tig2d-small" fill="#fff">
                  {t.name.toUpperCase().slice(0, 22)}
                </text>
                <text x={x + w - 40} y={ry + 20} className="tig2d-small" textAnchor="end" fill="#fff">
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
          <text x={W / 2} y={y + 150} className="tig2d-led-title tig2d-alarm" fill={TIG.alarm}>
            {title ?? "ALLARME CAOS!"}
          </text>
          <text x={W / 2} y={y + 214} className="tig2d-led-sub" fill="#fff">
            {sub ?? (focus.length >= 2 ? `TAVOLO ${focus[0].tableNo} ⚡ TAVOLO ${focus[1].tableNo}` : "SFIDA SPECIALE · 45 SECONDI")}
          </text>
        </g>
      );
      break;
    case "vs":
      body = (
        <g>
          <text x={W / 2} y={y + 46} className="tig2d-led-head" fill={TIG.amber}>
            {title ?? "SFIDA"}
          </text>
          {focus.slice(0, 2).map((t, i) => (
            <g key={t.teamId}>
              <rect x={i ? W / 2 + 90 : x + 40} y={y + 70} width={380} height={170} rx={14} fill={t.color} opacity={0.32} />
              <text x={i ? W / 2 + 280 : x + 230} y={y + 140} className="tig2d-led-sub" fill="#fff">
                TAVOLO {t.tableNo}
              </text>
              <text x={i ? W / 2 + 280 : x + 230} y={y + 190} className="tig2d-small" textAnchor="middle" fill="#fff">
                {t.name.toUpperCase().slice(0, 24)}
              </text>
            </g>
          ))}
          <text x={W / 2} y={y + 180} className="tig2d-led-title" fill={TIG.amber}>
            VS
          </text>
        </g>
      );
      break;
    case "awards": {
      const order = [2, 1, 3];
      body = (
        <g>
          <text x={W / 2} y={y + 46} className="tig2d-led-head" fill={TIG.gold}>
            {title ?? "PREMIAZIONE"}
          </text>
          {order.map((place, i) => {
            const t = ranked[place - 1];
            const shown = awardsShown >= 4 - place;
            const ph = place === 1 ? 150 : place === 2 ? 115 : 90;
            const px = W / 2 + (i - 1) * 230 - 100;
            return (
              <g key={place}>
                <rect x={px} y={y + h - 20 - ph} width={200} height={ph} rx={10} fill={shown && t ? t.color : "rgba(255,255,255,0.08)"} opacity={0.6} />
                <text x={px + 100} y={y + h - ph + 18} className="tig2d-led-sub" fill={place === 1 ? TIG.gold : "#fff"}>
                  {place}°
                </text>
                <text x={px + 100} y={y + h - ph - 30} className="tig2d-small" textAnchor="middle" fill="#fff">
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
      const big = mode === "logo" ? "TAVOLI IN GUERRA!" : mode === "break" ? (title ?? "PAUSA") : mode === "final" ? (title ?? "TUTTO O NIENTE!") : mode === "evolve" ? (title ?? "EVOLUZIONE!") : (title ?? "TAVOLI IN GUERRA!");
      const over = mode === "manche" || (mode === "title" && props.mancheNo) ? `MANCHE ${props.mancheNo ?? ""}` : null;
      const small = mode === "logo" ? (title ?? sub ?? "OGNI TAVOLO CONTA") : mode === "evolve" && focus[0] ? `TAVOLO ${focus[0].tableNo} · LIVELLO ${focus[0].mascotLevel}` : sub;
      const tone = mode === "final" ? TIG.gold : mode === "break" ? "#b9c7ff" : mode === "evolve" ? "#e4c4ff" : "#fff";
      body = (
        <g>
          {over && (
            <text x={W / 2} y={y + 62} className="tig2d-led-head" fill={TIG.amber}>
              {over}
            </text>
          )}
          <text x={W / 2} y={y + 160} className="tig2d-led-title" fill={tone}>
            {big}
          </text>
          {small && (
            <text x={W / 2} y={y + 222} className="tig2d-led-sub" fill="#e8eef5">
              {small}
            </text>
          )}
        </g>
      );
    }
  }
  return (
    <g>
      <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx={22} fill="#0b0f15" stroke={mode === "alarm" ? TIG.alarm : TIG.amber} strokeOpacity={0.55} strokeWidth={3} />
      <rect x={x} y={y} width={w} height={h} rx={16} fill="url(#tig2d-led)" />
      {body}
    </g>
  );
}

export default function Arena2D(props: ArenaProps) {
  const teams = useMemo(() => tableOrder(props.teams), [props.teams]);
  const layout = useMemo(() => podLayout(teams.length), [teams.length]);
  const [since, setSince] = useState(() => ({ phase: props.phase, at: props.now() }));
  if (since.phase !== props.phase) setSince({ phase: props.phase, at: props.now() });
  // battito (2 al secondo) per le scene a tempo: intro, premiazione
  const [, setTick] = useState(0);
  const timed = props.phase === "awards" || props.phase === "intro" || props.phase === "manche-intro" || props.phase === "reveal";
  useEffect(() => {
    if (!timed) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [timed]);
  const elapsed = Math.max(0, props.now() - since.at);
  const dir = directArena({ phase: props.phase, elapsedMs: elapsed, spotlight: props.spotlight, spotAgeMs: 0, speaking: false, hostCount: props.hosts.length });
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
  const awardsShown = props.phase === "awards" ? awardsRevealed(elapsed) : 0;
  const pods = layout.pods
    .map((p, i) => ({ p, t: teams[i], s: podScreen(p.x, p.z, layout.radius) }))
    .filter((x) => x.t)
    .sort((a, b) => a.s.depth - b.s.depth);
  const towerScale = 120 / (POD.maxHeight - POD.minHeight + 0.6);
  const podW = Math.max(46, Math.min(96, 1100 / Math.max(1, teams.length)));

  return (
    <div className={`tig2d ${props.className ?? ""}`} data-mood={dir.mood}>
      <div
        className="tig2d-frame"
        style={{ left: `${win.x0 * 100}%`, top: `${win.y0 * 100}%`, width: `${(win.x1 - win.x0) * 100}%`, height: `${(win.y1 - win.y0) * 100}%` }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Arena di TAVOLI IN GUERRA!: ${props.title ?? props.phase}`}>
          <defs>
            <linearGradient id="tig2d-led" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#1a0e05" />
              <stop offset="0.5" stopColor="#05070b" />
              <stop offset="1" stopColor="#031218" />
            </linearGradient>
            <radialGradient id="tig2d-floor" cx="0.5" cy="0.62" r="0.6">
              <stop offset="0" stopColor="rgba(255,138,31,0.16)" />
              <stop offset="0.6" stopColor="rgba(45,226,255,0.05)" />
              <stop offset="1" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <ellipse cx={W / 2} cy={640} rx={760} ry={250} fill="url(#tig2d-floor)" />
          <ellipse cx={W / 2} cy={640} rx={520} ry={150} fill="none" stroke={TIG.cyan} strokeOpacity={0.18} strokeDasharray="6 10" />
          <LedPanel props={props} mode={dir.led} teams={teams} awardsShown={awardsShown} />
          {/* palco (più in basso, davanti alle torri del fondo) */}
          <g transform="translate(0, 80)">
          <polygon points={`${W / 2 - 230},610 ${W / 2 - 120},560 ${W / 2 + 120},560 ${W / 2 + 230},610 ${W / 2 + 120},660 ${W / 2 - 120},660`} fill="#0b1016" stroke={TIG.amber} strokeWidth={3} />
          {props.hosts.slice(0, 4).map((h, i, arr) => {
            const hx = W / 2 + (i - (arr.length - 1) / 2) * 150;
            const info = HOST_MODELS[h.who];
            return (
              <g key={`${h.who}-${i}`} className={h.speaking ? "tig2d-host tig2d-speaking" : "tig2d-host"}>
                <rect x={hx - 66} y={572} width={132} height={44} rx={22} fill="#10151d" stroke={info.tint} strokeWidth={2.5} />
                <circle cx={hx - 44} cy={594} r={10} fill={info.tint} />
                <text x={hx + 6} y={601} className="tig2d-small" textAnchor="middle" fill="#fff">
                  {info.name.split(" (")[0].toUpperCase().slice(0, 12)}
                </text>
              </g>
            );
          })}
          </g>
          {/* torri */}
          {pods.map(({ t, s }) => {
            const hgt = columnHeight(t.score, scale) * towerScale;
            const dimmed = (dir.mood === "duel" || dir.mood === "chaos") && !focus.has(t.teamId);
            const lit = focus.has(t.teamId);
            const col = t.online ? t.color : "#4a525c";
            const topY = s.sy - hgt;
            const r = podW * 0.42;
            const arc = 2 * Math.PI * (r + 6);
            return (
              <g key={t.teamId} className={`tig2d-pod${dimmed ? " tig2d-dim" : ""}${lit ? " tig2d-lit" : ""}${t.online ? "" : " tig2d-off"}`}>
                <ellipse cx={s.sx} cy={s.sy + 4} rx={podW * 0.62} ry={podW * 0.18} fill={col} opacity={0.22} />
                <rect x={s.sx - podW * 0.32} y={topY} width={podW * 0.64} height={hgt} fill="#0d131b" stroke={col} strokeWidth={2.5} className="tig2d-tower" />
                <rect x={s.sx - podW * 0.32} y={topY} width={podW * 0.64} height={6} fill={col} />
                {/* Energia Caos */}
                <circle cx={s.sx} cy={topY - r - 4} r={r + 6} fill="none" stroke={TIG.chaos} strokeOpacity={0.22} strokeWidth={4} />
                <circle cx={s.sx} cy={topY - r - 4} r={r + 6} fill="none" stroke={TIG.chaos} strokeWidth={4} strokeDasharray={`${arc * Math.min(1, t.chaosProgress)} ${arc}`} transform={`rotate(-90 ${s.sx} ${topY - r - 4})`} />
                <foreignObject x={s.sx - r} y={topY - 2 * r - 4} width={2 * r} height={2 * r}>
                  <Mascot2DGlyph slot={t.mascotSlot} level={t.mascotLevel} color={col} />
                </foreignObject>
                <rect x={s.sx - podW * 0.5} y={topY - 2 * r - 58} width={podW} height={30} rx={8} fill={col} />
                <text x={s.sx} y={topY - 2 * r - 36} className="tig2d-num" textAnchor="middle" fill={inkOn(col)}>
                  {t.tableNo}
                </text>
                <text x={s.sx} y={s.sy + 30} className="tig2d-score" textAnchor="middle" fill={t.rank === 1 && t.score > 0 ? TIG.gold : "#fff"}>
                  {t.score.toLocaleString("it-IT")}
                </text>
                <text x={s.sx} y={s.sy + 52} className="tig2d-name" textAnchor="middle" fill="#cfd6df">
                  {t.online ? t.name.toUpperCase().slice(0, Math.max(6, Math.floor(podW / 7))) : "OFFLINE"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

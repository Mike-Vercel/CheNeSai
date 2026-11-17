"use client";

import type { ReactNode } from "react";
import { ART_H, ART_W, type IconKind, type Scene, type SceneItem, type Tone } from "@/lib/tig/games/components/art";

/**
 * Scene originali disegnate in codice (Memoria lampo): sfondi essenziali e 26 icone a tratto con un
 * riempimento d'accento. Ogni icona vive in un riquadro 100×100; i testi (`label`) sono grandi e leggibili.
 */

export const TONE_HEX: Record<Tone, string> = {
  lime: "var(--tg-gold)",
  red: "var(--tg-red-hi)",
  white: "var(--tg-cream)",
  amber: "var(--tg-teal-hi)",
  cyan: "var(--tg-sky)",
  violet: "var(--tg-violet)",
};

const INK = "var(--tg-cream)";
const NIGHT = "var(--tg-ink)";
const STEEL = "var(--tg-raised-2)";
const S = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** Testo adattato alla larghezza disponibile (una o due righe). */
function Label({ text, x, y, w, max = 22, fill = NIGHT, lines = 1 }: { text?: string; x: number; y: number; w: number; max?: number; fill?: string; lines?: 1 | 2 }) {
  if (!text) return null;
  let rows = [text];
  if (lines === 2 && text.length > 9 && text.includes(" ")) {
    const mid = text.length / 2;
    let cut = -1;
    for (let i = 0; i < text.length; i++) if (text[i] === " " && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
    rows = [text.slice(0, cut), text.slice(cut + 1)];
  }
  const longest = Math.max(...rows.map((r) => r.length));
  const fs = Math.max(9, Math.min(max * 1.15, w / (longest * 0.47)));
  return (
    <text x={x} y={y - ((rows.length - 1) * fs * 0.55)} fill={fill} fontSize={fs} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "var(--tg-display)" }}>
      {rows.map((r, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : fs * 1.08}>
          {r}
        </tspan>
      ))}
    </text>
  );
}

type IconFn = (tone: string, label?: string) => ReactNode;

const ICONS: Record<IconKind, IconFn> = {
  tazza: (t, l) => (
    <>
      <path d="M38 8c-5 6 5 9 0 15M52 6c-5 6 5 9 0 15" {...S} fill="none" opacity={0.7} />
      <path d="M68 40h6a11 11 0 0 1 0 22h-7" {...S} fill="none" />
      <path d="M20 30h48v38a16 16 0 0 1-16 16H36a16 16 0 0 1-16-16z" {...S} fill={t} />
      <Label text={l} x={44} y={56} w={42} max={18} />
    </>
  ),
  telefono: (t, l) => (
    <>
      <rect x={28} y={6} width={44} height={88} rx={10} {...S} fill={STEEL} />
      <rect x={33} y={15} width={34} height={66} rx={4} fill={t} opacity={0.9} />
      <rect x={44} y={86} width={12} height={3} rx={1.5} fill={INK} />
      <Label text={l} x={50} y={48} w={32} max={15} lines={2} />
    </>
  ),
  laptop: (t, l) => (
    <>
      <rect x={16} y={18} width={68} height={46} rx={5} {...S} fill={STEEL} />
      <rect x={21} y={23} width={58} height={36} rx={2} fill={t} opacity={0.9} />
      <path d="M8 68h84l-7 12H15z" {...S} fill={STEEL} />
      <Label text={l} x={50} y={41} w={54} max={16} lines={2} />
    </>
  ),
  pianta: (t) => (
    <>
      <path d="M50 62C50 44 40 30 26 24c0 16 10 30 24 34M50 62c0-20 8-36 24-42 2 18-8 34-24 40M50 60V40c-6-10-4-22 0-30 6 8 6 20 0 30" {...S} fill={t} fillOpacity={0.85} />
      <path d="M32 62h36l-5 28H37z" {...S} fill={STEEL} />
    </>
  ),
  lampada: (t) => (
    <>
      <path d="M30 16h40l12 28H18z" {...S} fill={t} />
      <path d="M50 44v38M32 88h36" {...S} fill="none" />
      <path d="M38 52l-6 8M62 52l6 8M50 54v8" stroke={t} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
    </>
  ),
  orologio: (t, l) => (
    <>
      <circle cx={50} cy={50} r={40} {...S} fill={NIGHT} />
      <circle cx={50} cy={50} r={33} fill="none" stroke={t} strokeWidth={3} opacity={0.8} />
      {[0, 90, 180, 270].map((a) => (
        <line key={a} x1={50} y1={14} x2={50} y2={20} stroke={INK} strokeWidth={3} transform={`rotate(${a} 50 50)`} />
      ))}
      {l ? <Label text={l} x={50} y={52} w={52} max={26} fill={INK} /> : <path d="M50 50V28M50 50l14 8" {...S} />}
    </>
  ),
  libro: (t, l) => (
    <>
      <rect x={24} y={10} width={52} height={80} rx={4} {...S} fill={t} />
      <path d="M33 10v80" stroke={NIGHT} strokeWidth={3} opacity={0.5} />
      <Label text={l} x={54} y={46} w={36} max={16} lines={2} />
    </>
  ),
  occhiali: (t) => (
    <>
      <circle cx={30} cy={54} r={15} {...S} fill={t} fillOpacity={0.3} />
      <circle cx={70} cy={54} r={15} {...S} fill={t} fillOpacity={0.3} />
      <path d="M45 52c3-4 7-4 10 0M15 50L6 40M85 50l9-10" {...S} fill="none" />
    </>
  ),
  chiavi: (t) => (
    <>
      <circle cx={30} cy={32} r={16} {...S} fill="none" />
      <path d="M42 44l38 38M70 72l-8 8M78 64l-8 8" {...S} fill="none" />
      <circle cx={30} cy={32} r={6} fill={t} />
    </>
  ),
  ombrello: (t) => (
    <>
      <path d="M10 50a40 34 0 0 1 80 0c-6-5-14-5-20 0-6-5-14-5-20 0-6-5-14-5-20 0-6-5-14-5-20 0z" {...S} fill={t} />
      <path d="M50 50v30a8 8 0 0 1-16 0" {...S} fill="none" />
      <path d="M50 16v-6" {...S} />
    </>
  ),
  zaino: (t) => (
    <>
      <path d="M38 20a12 12 0 0 1 24 0" {...S} fill="none" />
      <rect x={24} y={20} width={52} height={68} rx={16} {...S} fill={t} />
      <rect x={34} y={56} width={32} height={20} rx={5} {...S} fill={STEEL} />
    </>
  ),
  cuffie: (t) => (
    <>
      <path d="M20 62V52a30 30 0 0 1 60 0v10" {...S} fill="none" />
      <rect x={12} y={56} width={18} height={30} rx={7} {...S} fill={t} />
      <rect x={70} y={56} width={18} height={30} rx={7} {...S} fill={t} />
    </>
  ),
  pizza: (t, l) => (
    <>
      <path d="M10 34h80v46H10z" {...S} fill={STEEL} />
      <path d="M10 34l8-12h64l8 12z" {...S} fill={t} />
      <Label text={l} x={50} y={57} w={66} max={18} fill={INK} lines={2} />
    </>
  ),
  scarpe: (t) => (
    <>
      <path d="M10 70V44l18 4c6 10 18 14 30 14l24 6c6 2 8 6 8 10v2H10z" {...S} fill={t} />
      <path d="M10 76h80" {...S} />
      <path d="M30 52l6 6M40 56l4 6" stroke={NIGHT} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  portafoglio: (t) => (
    <>
      <rect x={14} y={28} width={72} height={50} rx={9} {...S} fill={t} />
      <path d="M60 44h26v20H60a10 10 0 0 1 0-20z" {...S} fill={STEEL} />
      <circle cx={62} cy={54} r={3.5} fill={INK} />
    </>
  ),
  poster: (t, l) => (
    <>
      <rect x={14} y={8} width={72} height={84} rx={2} {...S} fill={t} />
      <circle cx={50} cy={8} r={4} fill={INK} />
      <Label text={l} x={50} y={50} w={62} max={20} lines={2} />
    </>
  ),
  candela: (t) => (
    <>
      <path d="M50 10c8 10 8 18 0 22-8-4-8-12 0-22z" fill="var(--tg-teal-hi)" stroke={INK} strokeWidth={2.5} />
      <rect x={38} y={36} width={24} height={52} rx={3} {...S} fill={t} />
    </>
  ),
  postit: (t, l) => (
    <>
      <path d="M14 14h72v52L66 86H14z" {...S} fill={t} />
      <path d="M86 66H66v20" {...S} fill="none" />
      <Label text={l} x={48} y={46} w={62} max={20} lines={2} />
    </>
  ),
  borraccia: (t) => (
    <>
      <rect x={40} y={6} width={20} height={10} rx={3} {...S} fill={STEEL} />
      <path d="M38 16h24v10c8 4 10 10 10 18v38a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8V44c0-8 2-14 10-18z" {...S} fill={t} />
    </>
  ),
  valigia: (t, l) => (
    <>
      <path d="M38 26V16h24v10" {...S} fill="none" />
      <rect x={16} y={26} width={68} height={58} rx={9} {...S} fill={t} />
      <path d="M34 26v58M66 26v58" stroke={NIGHT} strokeWidth={3} opacity={0.4} />
      {l && (
        <>
          <rect x={6} y={60} width={58} height={26} rx={6} fill={INK} stroke={NIGHT} strokeWidth={2} />
          <Label text={l} x={35} y={73} w={52} max={15} />
        </>
      )}
    </>
  ),
  biglietto: (t, l) => (
    <>
      <path d="M6 28h88v14a8 8 0 0 0 0 16v14H6V58a8 8 0 0 0 0-16z" {...S} fill={t} />
      <path d="M70 30v40" stroke={NIGHT} strokeWidth={3} strokeDasharray="4 5" />
      <Label text={l} x={38} y={50} w={58} max={17} lines={2} />
    </>
  ),
  calendario: (t, l) => (
    <>
      <rect x={16} y={16} width={68} height={72} rx={7} {...S} fill={INK} />
      <path d="M16 23a7 7 0 0 1 7-7h54a7 7 0 0 1 7 7v13H16z" fill={t} stroke={INK} strokeWidth={3.5} />
      <path d="M34 10v12M66 10v12" {...S} />
      <Label text={l} x={50} y={62} w={60} max={22} lines={2} />
    </>
  ),
  torta: (t, l) => (
    <>
      <path d="M36 30V20M50 30V16M64 30V20" {...S} />
      <path d="M36 16c3 3 3 5 0 6-3-1-3-3 0-6zM50 12c3 3 3 5 0 6-3-1-3-3 0-6zM64 16c3 3 3 5 0 6-3-1-3-3 0-6z" fill="var(--tg-teal-hi)" />
      <rect x={20} y={30} width={60} height={24} rx={5} {...S} fill={t} />
      <rect x={12} y={54} width={76} height={32} rx={5} {...S} fill={STEEL} />
      <Label text={l} x={50} y={70} w={64} max={20} fill={INK} />
    </>
  ),
  monitor: (t, l) => (
    <>
      <rect x={8} y={12} width={84} height={56} rx={5} {...S} fill={STEEL} />
      <rect x={14} y={18} width={72} height={44} rx={2} fill={t} opacity={0.9} />
      <path d="M50 68v12M32 86h36" {...S} fill="none" />
      <Label text={l} x={50} y={40} w={66} max={18} lines={2} />
    </>
  ),
  gatto: (t) => (
    <>
      <path d="M30 88c-6-20-2-40 8-52l-4-22 14 12h4l14-12-4 22c10 12 14 32 8 52z" {...S} fill={t} />
      <path d="M70 84c14 0 18-12 10-18" {...S} fill="none" />
      <circle cx={44} cy={40} r={3} fill={NIGHT} />
      <circle cx={56} cy={40} r={3} fill={NIGHT} />
    </>
  ),
  palloncino: (t, l) => (
    <>
      <path d="M50 72c-2 10 6 14 0 24" {...S} fill="none" />
      <ellipse cx={50} cy={38} rx={28} ry={32} {...S} fill={t} />
      <path d="M46 72h8l-4-4z" fill={INK} />
      <Label text={l} x={50} y={38} w={40} max={22} />
    </>
  ),
};

export function SceneIcon({ kind, tone, label }: { kind: IconKind; tone: Tone; label?: string }) {
  return <>{ICONS[kind](TONE_HEX[tone], label)}</>;
}

/** Riquadro 100×100 di un'icona, per legende e opzioni. */
export function IconBadge({ kind, tone = "white", className }: { kind: IconKind; tone?: Tone; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <SceneIcon kind={kind} tone={tone} />
    </svg>
  );
}

const ITEM_PX = 150;

function Item({ item }: { item: SceneItem }) {
  const x = (item.x / 100) * ART_W;
  const y = (item.y / 100) * ART_H;
  const s = ((item.scale ?? 1) * ITEM_PX * (item.label ? 1.12 : 1)) / 100;
  return (
    <g transform={`translate(${x} ${y}) rotate(${item.rot ?? 0}) scale(${s}) translate(-50 -50)`}>
      <SceneIcon kind={item.kind} tone={item.tone ?? "white"} label={item.label} />
    </g>
  );
}

function Backdrop({ kind }: { kind: Scene["backdrop"] }) {
  const wall = "var(--tg-night-2)";
  const floor = "var(--tg-night-2)";
  const line = "color-mix(in srgb, var(--tg-cream) 9%, transparent)";
  const common = (
    <>
      <rect width={ART_W} height={ART_H} fill={wall} />
      <rect y={ART_H * 0.66} width={ART_W} height={ART_H * 0.34} fill={floor} />
      <line x1={0} y1={ART_H * 0.66} x2={ART_W} y2={ART_H * 0.66} stroke={line} strokeWidth={4} />
    </>
  );
  switch (kind) {
    case "ufficio":
      return (
        <>
          {common}
          <rect x={90} y={70} width={420} height={240} rx={10} fill="none" stroke={line} strokeWidth={6} />
          <line x1={300} y1={70} x2={300} y2={310} stroke={line} strokeWidth={4} />
          <rect x={120} y={560} width={1360} height={26} rx={8} fill="var(--tg-raised)" />
        </>
      );
    case "cucina":
      return (
        <>
          {common}
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={i * 140} y1={0} x2={i * 140} y2={ART_H * 0.66} stroke={line} strokeWidth={2} />
          ))}
          <rect x={60} y={560} width={1480} height={30} rx={6} fill="var(--tg-raised)" />
        </>
      );
    case "camera":
      return (
        <>
          {common}
          <rect x={1150} y={80} width={330} height={260} rx={12} fill="var(--tg-night)" stroke={line} strokeWidth={6} />
          <line x1={1315} y1={80} x2={1315} y2={340} stroke={line} strokeWidth={4} />
          <rect x={80} y={600} width={600} height={120} rx={30} fill="var(--tg-raised)" />
        </>
      );
    case "stazione":
      return (
        <>
          {common}
          <rect x={0} y={ART_H * 0.66} width={ART_W} height={18} fill="var(--tg-gold)" opacity={0.25} />
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={40 + i * 180} y={60} width={24} height={ART_H * 0.6} fill="var(--tg-night-2)" />
          ))}
        </>
      );
    case "festa":
      return (
        <>
          {common}
          <path d={`M0 90 ${Array.from({ length: 17 }, (_, i) => `Q${i * 100 + 50} 150 ${(i + 1) * 100} 90`).join(" ")}`} fill="none" stroke={line} strokeWidth={4} />
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d={`M${i * 100 + 30} 108l20 34 20-34z`} fill={i % 2 ? "var(--tg-red-hi)" : "var(--tg-gold)"} opacity={0.35} />
          ))}
          <rect x={160} y={580} width={1280} height={28} rx={8} fill="var(--tg-raised)" />
        </>
      );
    default:
      return (
        <>
          {common}
          <rect x={100} y={90} width={360} height={230} rx={10} fill="var(--tg-night)" stroke={line} strokeWidth={6} />
          <rect x={1080} y={250} width={420} height={18} rx={6} fill="var(--tg-raised)" />
          <rect x={260} y={600} width={1080} height={110} rx={36} fill="var(--tg-raised)" />
        </>
      );
  }
}

/** Scena completa (tela 16:9). */
export function SceneArt({ scene, alt, className }: { scene: Scene; alt: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className={className} role="img" aria-label={alt}>
      <Backdrop kind={scene.backdrop} />
      {scene.items.map((it, i) => (
        <Item key={i} item={it} />
      ))}
    </svg>
  );
}

"use client";

import { useProgress } from "@react-three/drei";

/**
 * Avanzamento VERO del caricamento dello studio (modelli e texture, dal gestore dei caricamenti di three.js).
 * Caricato a parte (next/dynamic): finché questo pezzo non arriva, la shell mostra la barra "in attesa".
 */
export default function LoadProgress({ label }: { label: string }) {
  const { progress, active, total } = useProgress();
  const pct = total === 0 && !active ? 8 : Math.max(8, Math.min(100, Math.round(progress)));
  return <ProgressBar pct={pct} label={label} />;
}

export function ProgressBar({ pct, label }: { pct: number | null; label: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-2" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
        {pct === null ? (
          <div className="gm-progress-wait absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#39ff14] to-transparent" />
        ) : (
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1f8f2a] to-[#39ff14] shadow-[0_0_14px_rgba(57,255,20,.7)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
        )}
      </div>
      <p className="text-xs font-black uppercase tracking-[0.25em] text-white/60">
        {label}
        {pct !== null && <span className="ml-2 tabular-nums text-[#39ff14]">{pct}%</span>}
      </p>
    </div>
  );
}

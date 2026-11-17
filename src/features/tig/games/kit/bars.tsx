"use client";

import { clsx } from "clsx";
import type { Option } from "@/lib/tig/games/components/choice";
import { Icon } from "./icons";

/** Barre orizzontali dei voti (percentuale scritta + barra + spunta sulla vincente: mai solo colore). */
export function VoteBars({ options, percent, counts, winners, tv = false }: { options: readonly Option[]; percent: Record<string, number>; counts?: Record<string, number>; winners: readonly string[]; tv?: boolean }) {
  return (
    <div className={clsx("flex flex-col", tv ? "gap-[0.9cqw]" : "gap-2")}>
      {options.map((o, i) => {
        const pct = percent[o.id] ?? 0;
        const win = winners.includes(o.id);
        return (
          <div key={o.id} className={clsx("relative overflow-hidden border-2", tv ? "rounded-[1cqw] px-[1.2cqw] py-[0.9cqw]" : "rounded-xl px-3 py-2.5", win ? "border-(--tg-gold)" : "border-(--tg-cream)/10")}>
            <div
              className={clsx("absolute inset-y-0 left-0 origin-left transition-transform duration-1000 ease-out", win ? "bg-[linear-gradient(90deg,rgba(242,177,52,.5),rgba(201,130,30,.38))]" : "bg-(--tg-cream)/[0.09]")}
              style={{ width: `${pct}%`, transitionDelay: `${i * 120}ms` }}
              aria-hidden
            />
            <div className="relative flex items-center gap-3">
              <span className={clsx("min-w-0 flex-1 font-extrabold leading-tight", tv ? "text-[1.9cqw]" : "text-base")}>{o.text}</span>
              {win && <Icon name="crown" className={clsx("shrink-0 text-(--tg-gold)", tv ? "h-[2cqw] w-[2cqw]" : "h-5 w-5")} />}
              <span className={clsx("tg-num shrink-0", tv ? "text-[2.6cqw]" : "text-2xl", win && "text-(--tg-gold)")}>{pct}%</span>
              {counts && <span className={clsx("shrink-0 font-bold text-(--tg-cream)/55", tv ? "text-[1.1cqw]" : "text-xs")}>{counts[o.id] ?? 0} tav.</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

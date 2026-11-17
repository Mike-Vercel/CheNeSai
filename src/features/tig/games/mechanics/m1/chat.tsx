"use client";

import { clsx } from "clsx";
import type { SurfaceChat } from "@/lib/tig/games/mechanics/sotto-la-superficie";

/**
 * Chat INVENTATA disegnata in HTML per «Sotto la superficie» (nessuna app reale imitata). Il messaggio da
 * interpretare è evidenziato con bordo, etichetta e testo per i lettori di schermo (mai solo il colore).
 */
export function SurfaceChatView({ chat, targetId, size = "phone", className }: { chat: SurfaceChat; targetId: string; size?: "phone" | "tv"; className?: string }) {
  const tv = size === "tv";
  const initials = chat.title
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <figure className={clsx("flex min-h-0 flex-col overflow-hidden border border-white/10 bg-[#0f131b]", tv ? "rounded-[1.4cqw]" : "rounded-3xl", className)} aria-label={`Chat «${chat.title}»`}>
      <div className={clsx("flex items-center border-b border-white/10 bg-[#161b25]", tv ? "gap-[0.8cqw] px-[1cqw] py-[0.7cqw]" : "gap-3 px-3 py-2.5")}>
        <span className={clsx("tg-num grid shrink-0 place-items-center rounded-full bg-[#2a3242] text-[#c6ff3d]", tv ? "h-[2.8cqw] w-[2.8cqw] text-[1.3cqw]" : "h-10 w-10 text-lg")}>{initials}</span>
        <span className="min-w-0">
          <span className={clsx("block truncate font-extrabold", tv ? "text-[1.45cqw]" : "text-base")}>{chat.title}</span>
          <span className={clsx("block truncate font-semibold text-white/55", tv ? "text-[1.05cqw]" : "text-xs")}>{chat.subtitle}</span>
        </span>
      </div>
      <ol className={clsx("flex min-h-0 flex-col", tv ? "gap-[0.55cqw] p-[0.9cqw] pt-[1.1cqw]" : "gap-2 p-3 pt-3.5")}>
        {chat.messages.map((m) => {
          const hit = m.id === targetId;
          return (
            <li
              key={m.id}
              className={clsx(
                "relative max-w-[88%]",
                m.mine ? "self-end bg-[#2b3a12] text-[#f3ffd6]" : "self-start bg-[#1d2330]",
                tv ? "rounded-[0.9cqw] px-[1cqw] py-[0.55cqw]" : "rounded-2xl px-3 py-2",
                hit && (tv ? "outline outline-[0.25cqw] outline-offset-[0.25cqw] outline-[#c6ff3d]" : "outline outline-[3px] outline-offset-2 outline-[#c6ff3d]"),
              )}
            >
              {hit && (
                <span className={clsx("tg-display absolute -top-[0.9em] right-[0.6em] rounded-md bg-[#c6ff3d] px-[0.45em] py-[0.1em] text-[#0b0d12]", tv ? "text-[1cqw]" : "text-xs")}>Doppio senso?</span>
              )}
              {!m.mine && <span className={clsx("block font-extrabold text-[#6fe7ff]", tv ? "text-[1cqw]" : "text-xs")}>{m.from}</span>}
              <span className={clsx("block font-semibold leading-snug", tv ? "text-[1.4cqw]" : "text-[15px]", hit && "font-extrabold")}>
                {m.text}
                <span className={clsx("float-right pl-[0.8em] pt-[0.45em] font-semibold leading-none text-white/50", tv ? "text-[0.85cqw]" : "text-[11px]")}>{m.time}</span>
              </span>
              {hit && <span className="sr-only"> · messaggio da interpretare</span>}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

"use client";

import { clsx } from "clsx";
import type { Chat } from "@/lib/tig/games/mechanics/screenshot-traditore";
import { HEADER_REGION } from "@/lib/tig/games/mechanics/screenshot-traditore";
import { Icon } from "./icons";

/**
 * Screenshot di una chat INVENTATA disegnato in HTML (nessuna app reale imitata: niente loghi, colori o
 * icone di prodotti esistenti). Ogni fumetto e l'intestazione sono regioni toccabili.
 */
export function ChatShot({
  chat,
  onTap,
  picked,
  mark,
  size = "phone",
  caption,
}: {
  chat: Chat;
  onTap?: (regionId: string) => void;
  picked?: string | null;
  /** al reveal: regione cambiata */
  mark?: string | null;
  size?: "phone" | "tv";
  caption?: string;
}) {
  const tv = size === "tv";
  const region = (id: string) =>
    clsx(
      "relative transition-[outline-color,transform] duration-150",
      onTap && "cursor-pointer active:scale-[0.99]",
      picked === id && "outline outline-[3px] outline-offset-2 outline-[#c6ff3d]",
      mark === id && "outline outline-[3px] outline-offset-2 outline-[#ff3b4e]",
    );
  const Tag = onTap ? "button" : "div";
  const initials = chat.title
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <figure className={clsx("flex flex-col overflow-hidden border border-white/10 bg-[#0f131b]", tv ? "rounded-[1.4cqw]" : "rounded-3xl")}>
      {caption && <figcaption className={clsx("tg-display bg-white/[0.06] text-center text-white/75", tv ? "py-[0.4cqw] text-[1.3cqw]" : "py-1.5 text-base")}>{caption}</figcaption>}
      <Tag
        type={onTap ? "button" : undefined}
        onClick={onTap ? () => onTap(HEADER_REGION) : undefined}
        aria-label={onTap ? `Intestazione: ${chat.title}, ${chat.subtitle}` : undefined}
        className={clsx("flex items-center gap-3 border-b border-white/10 bg-[#161b25] text-left", tv ? "gap-[0.8cqw] px-[1cqw] py-[0.7cqw]" : "px-3 py-2.5", region(HEADER_REGION))}
      >
        <span className={clsx("tg-num grid shrink-0 place-items-center rounded-full bg-[#2a3242] text-[#c6ff3d]", tv ? "h-[2.6cqw] w-[2.6cqw] text-[1.2cqw]" : "h-10 w-10 text-lg")}>{initials}</span>
        <span className="min-w-0">
          <span className={clsx("block truncate font-extrabold", tv ? "text-[1.35cqw]" : "text-base")}>{chat.title}</span>
          <span className={clsx("block truncate font-semibold text-white/55", tv ? "text-[1cqw]" : "text-xs")}>{chat.subtitle}</span>
        </span>
      </Tag>
      <div className={clsx("flex flex-col", tv ? "gap-[0.55cqw] p-[0.9cqw]" : "gap-2 p-3")}>
        {chat.messages.map((m) => (
          <Tag
            key={m.id}
            type={onTap ? "button" : undefined}
            onClick={onTap ? () => onTap(m.id) : undefined}
            aria-label={onTap ? `${m.mine ? "Tu" : m.from}, ore ${m.time}: ${m.text}` : undefined}
            className={clsx(
              "max-w-[86%] text-left",
              m.mine ? "self-end bg-[#2b3a12] text-[#f3ffd6]" : "self-start bg-[#1d2330]",
              tv ? "rounded-[0.9cqw] px-[0.9cqw] py-[0.5cqw]" : "rounded-2xl px-3 py-2",
              region(m.id),
            )}
          >
            {!m.mine && <span className={clsx("block font-extrabold text-[#6fe7ff]", tv ? "text-[0.95cqw]" : "text-xs")}>{m.from}</span>}
            <span className={clsx("block font-semibold leading-snug", tv ? "text-[1.25cqw]" : "text-[15px]")}>{m.text}</span>
            <span className={clsx("mt-0.5 flex items-center justify-end gap-1 text-white/50", tv ? "text-[0.85cqw]" : "text-[11px]")}>
              {m.time}
              {m.mine && <Icon name="check" className={tv ? "h-[0.9cqw] w-[0.9cqw]" : "h-3 w-3"} />}
            </span>
            {(picked === m.id || mark === m.id) && <span className="sr-only">{mark === m.id ? " · dettaglio cambiato" : " · selezionato"}</span>}
          </Tag>
        ))}
      </div>
    </figure>
  );
}

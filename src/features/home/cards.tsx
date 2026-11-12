import { clsx } from "clsx";
import Image from "next/image";
import Link from "next/link";
import type { CoverMark, GameEntry } from "./games";

/**
 * Copertina di un gioco nella riga "I nostri giochi" (verticale, come i titoli di un catalogo).
 * Tutta la copertina è il link al gioco: al passaggio del mouse (o con il focus) si alza e compaiono titolo e "Gioca".
 */
export function GameCard({ game, priority }: { game: GameEntry; priority?: boolean }) {
  const available = game.status === "disponibile" && game.href;
  const body = (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-coal-3 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] ring-1 ring-white/10 transition duration-300 group-hover:ring-2 group-hover:ring-white/85 group-focus-visible:ring-[3px] group-focus-visible:ring-gold">
      {game.cover.kind === "image" ? (
        <Image
          src={game.cover.src}
          alt=""
          width={game.cover.width}
          height={game.cover.height}
          sizes="(min-width: 768px) 20rem, 72vw"
          loading={priority ? "eager" : "lazy"}
          className={clsx(
            "h-full w-full object-cover transition duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:scale-[1.06] group-focus-visible:scale-[1.06]",
            game.cover.position === "top" && "object-top",
          )}
        />
      ) : game.cover.kind === "brand" ? (
        <GiramenteCover />
      ) : (
        <div className="absolute inset-0 grid place-items-center overflow-hidden" style={{ backgroundColor: game.cover.color }}>
          <div className="qz-rays absolute -inset-1/2 opacity-70" />
          <CoverArt mark={game.cover.mark} />
        </div>
      )}

      {/* titolo e azione: sempre in vista sul telefono, al passaggio del mouse dal tablet in su */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-4 pt-16 transition duration-300 md:translate-y-3 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-visible:translate-y-0 md:group-focus-visible:opacity-100">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none text-white">{game.title}</p>
          <p className="mt-1.5 truncate text-[13px] font-bold text-white/80">{game.meta.slice(2).join(" · ")}</p>
        </div>
        {available ? (
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold text-ink transition duration-300 group-hover:scale-110">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor">
              <path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12.2-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z" />
            </svg>
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-black/75 px-3 py-1 text-[13px] font-black text-white">Presto disponibile</span>
        )}
      </div>
    </div>
  );
  const cls = "group block w-[72vw] max-w-[19rem] shrink-0 md:w-[20rem] md:max-w-none";
  if (!available) return <div className={cls} aria-label={`${game.title}: presto disponibile`} role="img">{body}</div>;
  return (
    <Link
      href={game.href!}
      prefetch={false}
      aria-label={`Gioca a ${game.title}`}
      className={clsx(cls, "rounded-2xl transition duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:outline-none active:scale-[0.98]")}
    >
      {body}
    </Link>
  );
}

/** GIRAMENTE!: copertina provvisoria in CSS (nero, verde elettrico sopra, rosso sotto, ruota e titolo). */
function GiramenteCover() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#080b0d]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(57,255,20,.55),transparent_60%),radial-gradient(ellipse_at_50%_100%,rgba(255,37,58,.55),transparent_60%)]" />
      <div className="absolute left-1/2 top-[14%] aspect-square w-[64%] -translate-x-1/2 rounded-full border-[6px] border-[#9aa4ab] bg-[conic-gradient(#0f7a2a_0_12.5%,#efe6d2_0_25%,#c3162a_0_37.5%,#0f7a2a_0_50%,#c3162a_0_62.5%,#efe6d2_0_75%,#0f7a2a_0_87.5%,#c3162a_0)] shadow-[0_0_40px_rgba(57,255,20,.45)] transition duration-700 group-hover:rotate-[135deg]">
        <span className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#39ff14] bg-[#071009]" />
      </div>
      <span className="absolute left-1/2 top-[9%] h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[20px] border-x-transparent border-t-[#39ff14]" />
      <div className="absolute inset-x-0 bottom-[22%] text-center">
        <p className="-skew-x-6 font-display text-[2.6rem] leading-none text-white drop-shadow-[0_3px_0_#000] md:text-5xl">
          GIRAMENTE<span className="text-[#39ff14]">!</span>
        </p>
        <p className="mx-auto mt-2 w-fit -rotate-2 rounded bg-white px-2 py-0.5 text-xs font-black italic text-black">La ruota gira. La mente decide.</p>
      </div>
    </div>
  );
}

/** Copertine provvisorie dei giochi in arrivo: un segno grande e semplice, in bianco sul colore. */
function CoverArt({ mark }: { mark: CoverMark }) {
  const cls = "relative h-[46%] w-auto text-white transition duration-500 group-hover:scale-110";
  if (mark === "note") {
    return (
      <svg viewBox="0 0 64 64" className={cls} fill="currentColor" aria-hidden>
        <path d="M24 10l30-6v38a9 9 0 1 1-6-8.5V17l-18 3.6V48a9 9 0 1 1-6-8.5z" />
      </svg>
    );
  }
  if (mark === "pencil") {
    return (
      <svg viewBox="0 0 64 64" className={cls} fill="currentColor" aria-hidden>
        <path d="M44 6l14 14-30 30-14-14zM11 39l14 14-17 5z" />
      </svg>
    );
  }
  return <span className="relative font-display text-[6rem] leading-none text-white transition duration-500 group-hover:scale-110 md:text-[8rem]">Aa</span>;
}

import { clsx } from "clsx";
import Image from "next/image";
import Link from "next/link";
import { tigTitleFont } from "@/features/tig/games/kit/fonts-title";
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
        game.cover.brand === "tig" ? <TigCover /> : <GiramenteCover />
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

/**
 * TAVERNA DEI PIRATI (ex TAVOLI IN GUERRA!): copertina provvisoria disegnata in codice — la baia di notte vista dal molo:
 * luna sul mare, un galeone ancorato con le finestre accese (disegno originale), le lanterne della taverna,
 * il titolo in foglia d'oro (Pirata One) e il nastro di ceralacca.
 */
export function TigCover({ large = false }: { large?: boolean }) {
  return (
    <div className={clsx(tigTitleFont.variable, "absolute inset-0 overflow-hidden bg-[#07131a]")}>
      {/* cielo, stelle, luna */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#081a24_0%,#0d2a37_50%,#123a47_58%,#0a2029_62%,#06121a_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(255,244,214,.9)_0_1px,transparent_1.6px),radial-gradient(circle_at_33%_8%,rgba(255,244,214,.7)_0_1px,transparent_1.6px),radial-gradient(circle_at_58%_19%,rgba(255,244,214,.8)_0_1px,transparent_1.6px),radial-gradient(circle_at_88%_34%,rgba(255,244,214,.6)_0_1px,transparent_1.6px),radial-gradient(circle_at_6%_40%,rgba(255,244,214,.6)_0_1px,transparent_1.6px),radial-gradient(circle_at_46%_33%,rgba(255,244,214,.5)_0_1px,transparent_1.6px)]" />
      <div className="absolute right-[13%] top-[38%] aspect-square w-[11%] rounded-full bg-[radial-gradient(circle_at_40%_38%,#fffaf0,#f6e3b4_60%,#e2c48a)] shadow-[0_0_30px_8px_rgba(255,236,190,.35),0_0_90px_30px_rgba(255,236,190,.12)]" />
      {/* il galeone sull'orizzonte (silhouette originale, finestre accese) */}
      <svg viewBox="0 0 200 120" aria-hidden className="absolute bottom-[34%] left-[8%] w-[62%] transition duration-700 group-hover:-translate-y-1">
        <g fill="#0a1820">
          <path d="M62 86V10M102 86V4M140 86V16" stroke="#0a1820" strokeWidth="2.4" />
          <path d="M176 79L199 62" stroke="#0a1820" strokeWidth="2" />
          <path d="M14 80l-2-16h30l2 16zM12 80c8 14 30 18 58 18h80c20 0 30-6 36-20l-10 3H40z" />
        </g>
        <g fill="#16303d" stroke="#284b59" strokeWidth=".6">
          <path d="M46 18q16-4 32 0q-3 11 0 22q-16-4-32 0q3-11 0-22z" />
          <path d="M44 44q18-4 36 0q-3 12 0 24q-18-4-36 0q3-12 0-24z" />
          <path d="M84 12q18-4 36 0q-3 12 0 24q-18-4-36 0q3-12 0-24z" />
          <path d="M82 40q20-4 40 0q-3 13 0 26q-20-4-40 0q3-13 0-26z" />
          <path d="M126 24q14-4 28 0q-3 10 0 20q-14-4-28 0q3-10 0-20z" />
          <path d="M124 48q16-4 32 0q-3 11 0 22q-16-4-32 0q3-11 0-22z" />
        </g>
        <path d="M102 4l12 3-12 3zM62 10l9 2.5-9 2.5zM140 16l9 2.5-9 2.5z" fill="#c8312b" />
        <g fill="#ffd56b">
          <rect x="17" y="69" width="3" height="3" rx=".6" />
          <rect x="23" y="69" width="3" height="3" rx=".6" />
          <rect x="29" y="69" width="3" height="3" rx=".6" />
          <rect x="50" y="88" width="2.6" height="2.6" rx=".6" opacity=".8" />
          <rect x="70" y="89" width="2.6" height="2.6" rx=".6" opacity=".8" />
          <rect x="130" y="89" width="2.6" height="2.6" rx=".6" opacity=".7" />
        </g>
      </svg>
      {/* mare: riflesso della luna e onde */}
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[radial-gradient(ellipse_6%_70%_at_82%_0%,rgba(255,236,190,.4),transparent_72%),repeating-linear-gradient(180deg,transparent_0_7px,rgba(108,196,236,.08)_7px_8px)]" />
      {/* lanterne del molo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_4%_104%,rgba(242,177,52,.55),transparent_42%),radial-gradient(ellipse_at_98%_106%,rgba(242,160,52,.42),transparent_40%)]" />
      <div className={large ? "absolute inset-x-0 top-[7%] text-center" : "absolute inset-x-0 top-[6%] text-center"}>
        <p className="-rotate-2 font-[family-name:var(--font-tig-display),Georgia,serif] leading-[0.9] text-[#f6ead2] [text-shadow:0_3px_0_#2a190d,0_0_24px_rgba(0,0,0,.6)]">
          <span className={large ? "block text-[2.4rem] md:text-[3.4rem]" : "block text-[1.9rem] md:text-[2.2rem]"}>Taverna dei</span>
          <span className={clsx("block bg-[linear-gradient(180deg,#fff6d6_0%,#ffe08a_22%,#f2b134_48%,#c07f1a_63%,#ffd56b_82%,#fff0bf_100%)] bg-clip-text px-[0.05em] text-transparent [filter:drop-shadow(0_0.035em_0_#5a3416)_drop-shadow(0_0.035em_0_#2a190d)_drop-shadow(0_0_0.3em_rgba(242,177,52,.4))] [text-shadow:none]", large ? "text-[4.6rem] md:text-[6.6rem]" : "text-[3.8rem] md:text-[4.2rem]")}>
            Pirati
          </span>
        </p>
        <p className="mx-auto mt-2 w-fit rotate-1 rounded-sm border border-[#5c120e] bg-[linear-gradient(180deg,#dc4a40,#c8312b_55%,#9c231e)] px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-[#fff4e6] shadow-[0_3px_8px_rgba(0,0,0,.5)]">Ogni tavolo è una ciurma</p>
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

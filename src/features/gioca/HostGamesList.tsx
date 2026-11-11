import Link from "next/link";
import type { HostGameSummary } from "@/lib/server/gioco-libero";

const fmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

function statusLabel(g: HostGameSummary): string {
  if (g.status === "finished" || g.status === "archived" || g.phase === "FINISHED") return "Terminata";
  if (g.phase === "LOBBY") return "In attesa dei giocatori";
  if (g.phase === "PAUSED") return "In pausa";
  if (g.status === "live") return "In corso";
  return "Pronta";
}

/** Ultime partite dell'host: quelle aperte si riprendono (es. dopo aver chiuso la finestra). */
export function HostGamesList({ games }: { games: HostGameSummary[] }) {
  if (games.length === 0) {
    return <p className="mt-3 text-base font-bold text-white/75">Qui trovi le partite che crei, per riprenderle se chiudi la finestra.</p>;
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {games.map((g) => {
        const done = statusLabel(g) === "Terminata";
        return (
          <li key={g.id}>
            <Link href={`/gioca/partita/${g.id}`} className="flex items-center gap-4 rounded-2xl bg-night-2 px-4 py-3 transition hover:bg-night-3">
              <span className="font-display text-xl tracking-widest text-gold">{g.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-extrabold">{statusLabel(g)}</span>
                <span className="block text-sm font-bold text-white/70">
                  {fmt.format(new Date(g.createdAt))} · {g.players} {g.players === 1 ? "giocatore" : "giocatori"}
                </span>
              </span>
              <span className="text-sm font-black text-white/80">{done ? "Podio" : "Riprendi"} →</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

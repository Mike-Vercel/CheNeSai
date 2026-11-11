import Link from "next/link";
import { aggregatedLeaderboard, monthRange } from "@/lib/server/cms/admin";
import { Character, Logo } from "@/features/game/components/brand";
import { formatPoints } from "@/features/game/lines";

export const metadata = { title: "Classifica del mese" };

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ mese?: string }> }) {
  const { mese } = await searchParams;
  const month = mese && /^\d{4}-\d{2}$/.test(mese) ? mese : new Date().toISOString().slice(0, 7);
  const data = await aggregatedLeaderboard(monthRange(month));
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return (
    <main className="qz-stage qz-safe min-h-dvh px-4 py-8">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
        <Link href="/">
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-3">
          <Character who="regina" small className="w-24" />
          <div>
            <h1 className="font-display text-3xl">Classifica di {MONTHS[m - 1]} {y}</h1>
            <p className="font-bold text-white/70">
              {data.sessions} serate · {data.mode === "sum_points" ? "somma dei punti" : "punti per piazzamento"}
            </p>
          </div>
        </div>
        <div className="flex gap-3 text-sm font-bold">
          <Link className="rounded-full bg-black/40 px-3 py-1" href={`/classifica?mese=${prev}`}>
            ← mese prima
          </Link>
          <Link className="rounded-full bg-black/40 px-3 py-1" href={`/classifica?mese=${next}`}>
            mese dopo →
          </Link>
        </div>
        {data.standings.length === 0 ? (
          <p className="rounded-2xl bg-black/40 p-6 text-center font-bold text-white/80">Ancora nessuna serata conclusa in questo mese.</p>
        ) : (
          <ol className="flex w-full flex-col gap-2">
            {data.standings.slice(0, 50).map((s) => (
              <li key={s.rank} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${s.rank <= 3 ? "border-2 border-gold bg-gold/15" : "bg-black/40"}`}>
                <span className="w-8 text-center font-display text-2xl text-gold">{s.rank}</span>
                <span className="min-w-0 flex-1 truncate font-extrabold">{s.nickname}</span>
                <span className="text-xs text-white/60">
                  {s.sessions} serate{s.wins > 0 ? ` · ${s.wins} 🏆` : ""}
                </span>
                <span className="font-display text-xl">{formatPoints(s.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

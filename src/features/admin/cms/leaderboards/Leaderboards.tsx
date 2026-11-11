"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Button, EmptyState, Field, Input, Modal, Panel, Select, useConfirm, useToast } from "@/components/ui";
import { errorMessage, fieldErrors, qs, send, useApi, useRunner } from "../api";
import { ErrorBlock, InfoNote, LoadingBlock, PageHeader, Segmented } from "../common";
import { AGGREGATION_LABEL, fmtDay, fmtNum, plural } from "../format";
import type { LeaderboardResponse, Season } from "../types";

type Mode = "" | "sum_points" | "placement_points";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function StandingsTable({ data }: { data: LeaderboardResponse }) {
  if (data.standings.length === 0) {
    return <EmptyState title="Nessun punteggio nel periodo">Le serate di prova non vengono conteggiate.</EmptyState>;
  }
  return (
    <div>
      <p className="mb-3 text-sm text-white/65">
        {fmtDay(data.from)} – {fmtDay(data.to)} · {plural(data.sessions, "serata", "serate")} · {AGGREGATION_LABEL[data.mode] ?? data.mode}
      </p>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-white/55">
            <tr>
              <th scope="col" className="w-14 px-3 py-2 text-center">
                Pos.
              </th>
              <th scope="col" className="px-3 py-2">
                Giocatore
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {data.mode === "placement_points" ? "Punti classifica" : "Punti"}
              </th>
              <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">
                Serate
              </th>
              <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">
                Vittorie
              </th>
              <th scope="col" className="hidden px-3 py-2 text-right md:table-cell">
                Miglior pos.
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.standings.map((s) => (
              <tr key={`${s.rank}-${s.nickname}`} className={clsx(s.rank <= 3 && "bg-gold/[0.04]")}>
                <td className="px-3 py-2 text-center font-display text-lg">
                  <span className={clsx(s.rank === 1 ? "text-gold" : s.rank === 2 ? "text-[#d9e2ec]" : s.rank === 3 ? "text-[#e3a06a]" : "text-white/70")}>{s.rank}</span>
                </td>
                <td className="px-3 py-2 font-bold">
                  {s.nickname}
                  <span className="block text-xs font-normal text-white/50 sm:hidden">
                    {plural(s.sessions, "serata", "serate")} · {plural(s.wins, "vittoria", "vittorie")}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-extrabold text-gold">{fmtNum(s.total)}</td>
                <td className="hidden px-3 py-2 text-right sm:table-cell">{s.sessions}</td>
                <td className="hidden px-3 py-2 text-right sm:table-cell">{s.wins}</td>
                <td className="hidden px-3 py-2 text-right md:table-cell">{s.bestRank}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeasonModal({ season, onClose, onSaved }: { season: Season | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const year = new Date().getFullYear();
  const [name, setName] = useState(season?.name ?? "");
  const [startsOn, setStartsOn] = useState(season?.startsOn ?? `${year}-09-01`);
  const [endsOn, setEndsOn] = useState(season?.endsOn ?? `${year + 1}-06-30`);
  const [aggregation, setAggregation] = useState<Season["aggregation"]>(season?.aggregation ?? "sum_points");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (endsOn < startsOn) {
      setErrors({ endsOn: "La fine deve essere dopo l'inizio" });
      return;
    }
    setSaving(true);
    setErrors({});
    setError(null);
    try {
      const body = { name: name.trim(), startsOn, endsOn, aggregation };
      if (season) await send(`/api/admin/seasons/${season.id}`, "PUT", body);
      else await send("/api/admin/seasons", "POST", body);
      toast("ok", season ? "Stagione aggiornata" : "Stagione creata");
      onSaved();
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setError(Object.keys(fe).length ? "Controlla i campi" : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={season ? "Modifica stagione" : "Nuova stagione"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" type="submit" form="season-form" loading={saving}>
            Salva
          </Button>
        </>
      }
    >
      <form id="season-form" onSubmit={save} className="space-y-3">
        <Field label="Nome" error={errors.name}>
          {(id) => <Input id={id} required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Stagione 2026/27" />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inizio" error={errors.startsOn}>
            {(id) => <Input id={id} type="date" required value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />}
          </Field>
          <Field label="Fine" error={errors.endsOn}>
            {(id) => <Input id={id} type="date" required value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />}
          </Field>
        </div>
        <Field label="Calcolo della classifica" error={errors.aggregation} hint="Punti piazzamento: 1° 25, 2° 18, 3° 15… (configurabili nelle impostazioni)">
          {(id) => (
            <Select id={id} value={aggregation} onChange={(e) => setAggregation(e.target.value as Season["aggregation"])}>
              <option value="sum_points">Somma dei punti delle serate</option>
              <option value="placement_points">Punti in base al piazzamento</option>
            </Select>
          )}
        </Field>
        {error && <InfoNote tone="danger">{error}</InfoNote>}
      </form>
    </Modal>
  );
}

export function Leaderboards() {
  const confirm = useConfirm();
  const { run } = useRunner();
  const [tab, setTab] = useState<"month" | "season">("month");
  const [month, setMonth] = useState(currentMonth);
  const [mode, setMode] = useState<Mode>("");
  const [seasonId, setSeasonId] = useState("");
  const [seasonModal, setSeasonModal] = useState<{ season: Season | null } | null>(null);
  const seasons = useApi<{ seasons: Season[] }>("/api/admin/seasons");
  const list = seasons.data?.seasons ?? [];
  const activeSeason = seasonId || list[0]?.id || "";
  const url =
    tab === "month"
      ? `/api/admin/leaderboards${qs({ month, mode })}`
      : activeSeason
        ? `/api/admin/leaderboards${qs({ seasonId: activeSeason, mode })}`
        : null;
  const board = useApi<LeaderboardResponse>(url);

  async function removeSeason(s: Season) {
    const ok = await confirm({
      title: "Eliminare la stagione?",
      message: `"${s.name}" verrà eliminata. Le serate collegate (${s.sessions}) restano, senza stagione.`,
      confirmLabel: "Elimina",
      danger: true,
    });
    if (!ok) return;
    const r = await run(`ds-${s.id}`, () => send(`/api/admin/seasons/${s.id}`, "DELETE"), "Stagione eliminata");
    if (r) {
      if (seasonId === s.id) setSeasonId("");
      seasons.reload();
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Classifiche" subtitle="Classifiche mensili e di stagione dei giocatori di CHE NE SAI?!" />
      <InfoNote>
        I giocatori sono riconosciuti dall&apos;<strong>identità del dispositivo</strong> o dal <strong>codice di recupero</strong>, non dal nickname: chi cambia
        nome resta la stessa persona, due persone con lo stesso nome restano distinte. Le serate di <strong>prova generale</strong> sono escluse.
      </InfoNote>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title={board.data?.title ?? "Classifica"}
          actions={
            <Segmented
              label="Periodo"
              value={tab}
              onChange={setTab}
              options={[
                { value: "month", label: "Mese" },
                { value: "season", label: "Stagione" },
              ]}
            />
          }
        >
          <div className="mb-4 flex flex-wrap items-end gap-2">
            {tab === "month" ? (
              <>
                <Button variant="ghost" aria-label="Mese precedente" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
                  ←
                </Button>
                <Field label="Mese">{(id) => <Input id={id} type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />}</Field>
                <Button variant="ghost" aria-label="Mese successivo" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
                  →
                </Button>
              </>
            ) : (
              <Field label="Stagione">
                {(id) => (
                  <Select id={id} value={activeSeason} onChange={(e) => setSeasonId(e.target.value)} disabled={list.length === 0}>
                    {list.length === 0 && <option value="">Nessuna stagione</option>}
                    {list.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Calcolo">
              {(id) => (
                <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                  <option value="">{tab === "month" ? "Predefinito (impostazioni)" : "Predefinito della stagione"}</option>
                  <option value="sum_points">Somma dei punti</option>
                  <option value="placement_points">Punti piazzamento</option>
                </Select>
              )}
            </Field>
          </div>
          {!url ? (
            <EmptyState title="Nessuna stagione">Crea una stagione nel pannello a lato.</EmptyState>
          ) : board.error ? (
            <ErrorBlock message={board.error} onRetry={board.reload} />
          ) : !board.data || (board.loading && !board.data) ? (
            <LoadingBlock />
          ) : (
            <div aria-busy={board.loading} className={clsx(board.loading && "opacity-60")}>
              <StandingsTable data={board.data} />
            </div>
          )}
        </Panel>

        <Panel
          title="Stagioni"
          actions={
            <Button size="sm" variant="gold" onClick={() => setSeasonModal({ season: null })}>
              + Nuova
            </Button>
          }
        >
          {seasons.error ? (
            <ErrorBlock message={seasons.error} onRetry={seasons.reload} />
          ) : !seasons.data ? (
            <LoadingBlock />
          ) : list.length === 0 ? (
            <EmptyState title="Nessuna stagione">Le stagioni raggruppano le serate per una classifica di lungo periodo.</EmptyState>
          ) : (
            <ul className="divide-y divide-white/10">
              {list.map((s) => (
                <li key={s.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-left font-bold hover:text-gold"
                        onClick={() => {
                          setTab("season");
                          setSeasonId(s.id);
                        }}
                      >
                        {s.name}
                      </button>
                      <p className="text-xs text-white/55">
                        {fmtDay(s.startsOn)} – {fmtDay(s.endsOn)} · {plural(s.sessions, "serata", "serate")}
                        <br />
                        {AGGREGATION_LABEL[s.aggregation]}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSeasonModal({ season: s })}>
                        Modifica
                      </Button>
                      <Button size="sm" variant="ghost" className="text-[#ff8098]" aria-label={`Elimina ${s.name}`} onClick={() => removeSeason(s)}>
                        ✕
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-white/50">
            La classifica di stagione somma tutte le serate reali giocate tra la data di inizio e quella di fine. Il conteggio &laquo;serate&raquo; indica quelle
            collegate alla stagione dai dati della serata.
          </p>
        </Panel>
      </div>
      {seasonModal && (
        <SeasonModal
          season={seasonModal.season}
          onClose={() => setSeasonModal(null)}
          onSaved={() => {
            setSeasonModal(null);
            seasons.reload();
            board.reload();
          }}
        />
      )}
    </div>
  );
}

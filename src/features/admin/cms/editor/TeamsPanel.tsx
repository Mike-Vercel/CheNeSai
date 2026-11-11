"use client";

import { useState } from "react";
import { Button, Field, Input, Panel, Select, useConfirm, useToast } from "@/components/ui";
import {
  MAX_TEAMS,
  MIN_TEAMS,
  TEAM_AGGREGATION_LABEL,
  TEAM_AGGREGATIONS,
  TEAM_COLORS,
  TEAM_MODE_LABEL,
  TEAM_MODES,
  teamsEnabled,
  type TeamAggregation,
  type TeamMode,
} from "@/lib/game-engine/teams";
import type { TeamAdmin } from "@/lib/server/cms/teams";
import { errorMessage, send, useApi, useRunner } from "../api";
import { Checkbox, InfoNote } from "../common";
import type { SessionDetail } from "../types";

/**
 * Modalità squadre della serata: individuale / squadre / squadre + individuale,
 * scelta della squadra (giocatori o regia), aggregazione (somma o media) e squadre (2–8, con colore).
 * Le squadre si possono gestire anche a serata pubblicata (es. durante la lobby), non a serata conclusa.
 */
export function TeamsPanel({ session, canEdit, onChanged }: { session: SessionDetail; canEdit: boolean; onChanged: () => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  const { busy, run } = useRunner();
  const teamsReq = useApi<{ teams: TeamAdmin[] }>(`/api/admin/sessions/${session.id}/teams`);
  const teams = teamsReq.data?.teams ?? [];
  const cur = session.settings.teams ?? { mode: "individual" as TeamMode, selfSelect: false, aggregation: "sum" as TeamAggregation };
  const [mode, setMode] = useState<TeamMode>(cur.mode);
  const [selfSelect, setSelfSelect] = useState(cur.selfSelect);
  const [aggregation, setAggregation] = useState<TeamAggregation>(cur.aggregation);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const closed = session.status === "finished" || session.status === "archived";
  const editable = canEdit && !closed;
  const dirty = mode !== cur.mode || selfSelect !== cur.selfSelect || aggregation !== cur.aggregation;
  const enabled = teamsEnabled(mode);

  async function saveMode() {
    const r = await run("teams-mode", () => send(`/api/admin/sessions/${session.id}`, "PATCH", { settings: { teams: { mode, selfSelect, aggregation } } }), "Modalità squadre salvata");
    if (r) onChanged();
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("Almeno 2 caratteri");
      return;
    }
    try {
      await send(`/api/admin/sessions/${session.id}/teams`, "POST", { name: trimmed });
      setName("");
      teamsReq.reload();
      onChanged();
    } catch (err) {
      setNameError(errorMessage(err));
    }
  }

  async function patchTeam(t: TeamAdmin, body: Record<string, unknown>) {
    const r = await run(`team-${t.id}`, () => send(`/api/admin/sessions/${session.id}/teams/${t.id}`, "PATCH", body));
    if (r) teamsReq.reload();
  }

  async function removeTeam(t: TeamAdmin) {
    const ok = await confirm({
      title: `Eliminare la squadra ${t.name}?`,
      message: t.members > 0 ? `I suoi ${t.members} giocatori restano in partita, senza squadra.` : "La squadra non ha giocatori.",
      confirmLabel: "Elimina squadra",
      danger: true,
    });
    if (!ok) return;
    const r = await run(`del-${t.id}`, () => send(`/api/admin/sessions/${session.id}/teams/${t.id}`, "DELETE"), "Squadra eliminata");
    if (r) {
      teamsReq.reload();
      onChanged();
    }
  }

  async function rename(t: TeamAdmin) {
    const next = window.prompt("Nuovo nome della squadra", t.name);
    if (next === null || next.trim() === t.name) return;
    try {
      await send(`/api/admin/sessions/${session.id}/teams/${t.id}`, "PATCH", { name: next.trim() });
      teamsReq.reload();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  return (
    <Panel title="Squadre">
      <div className="space-y-3">
        <div className="grid gap-3">
          <Field label="Modalità di gioco">
            {(id) => (
              <Select id={id} value={mode} disabled={!editable} onChange={(e) => setMode(e.target.value as TeamMode)}>
                {TEAM_MODES.map((m) => (
                  <option key={m} value={m}>
                    {TEAM_MODE_LABEL[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {enabled && (
            <>
              <Field label="Punteggio di squadra" hint="Con la media le squadre con meno giocatori non sono svantaggiate.">
                {(id) => (
                  <Select id={id} value={aggregation} disabled={!editable} onChange={(e) => setAggregation(e.target.value as TeamAggregation)}>
                    {TEAM_AGGREGATIONS.map((a) => (
                      <option key={a} value={a}>
                        {TEAM_AGGREGATION_LABEL[a]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Checkbox
                checked={selfSelect}
                disabled={!editable}
                onChange={setSelfSelect}
                label="I giocatori scelgono la squadra dal telefono"
                hint="Altrimenti le squadre le assegna la regia (anche con «Bilancia squadre»)."
              />
            </>
          )}
          {editable && dirty && (
            <Button variant="gold" size="sm" loading={busy === "teams-mode"} onClick={() => void saveMode()}>
              Salva modalità
            </Button>
          )}
        </div>

        {(enabled || teams.length > 0) && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-white/80">
              Squadre ({teams.length}/{MAX_TEAMS})
            </p>
            {enabled && teams.length < MIN_TEAMS && <InfoNote tone="warn">Crea almeno {MIN_TEAMS} squadre per giocare a squadre.</InfoNote>}
            <ul className="space-y-1.5">
              {teams.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 text-sm">
                  <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-white/70" style={{ background: t.color }} />
                  <span className="min-w-0 flex-1 truncate font-bold">{t.name}</span>
                  <span className="text-xs text-white/50">{t.members} gioc.</span>
                  {editable && (
                    <>
                      <Select
                        aria-label={`Colore di ${t.name}`}
                        className="h-7 w-24 py-0 text-xs"
                        value={t.color}
                        disabled={busy === `team-${t.id}`}
                        onChange={(e) => void patchTeam(t, { color: e.target.value })}
                      >
                        {[...new Set([t.color, ...TEAM_COLORS])].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                      <button type="button" className="rounded bg-white/10 px-2 py-0.5 text-xs font-bold" onClick={() => void rename(t)}>
                        Rinomina
                      </button>
                      <button type="button" className="rounded bg-flame/30 px-2 py-0.5 text-xs font-bold" onClick={() => void removeTeam(t)}>
                        Elimina
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {editable && teams.length < MAX_TEAMS && (
              <form onSubmit={addTeam} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input aria-label="Nome della nuova squadra" placeholder="Es. I Fenicotteri" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
                  {nameError && <p className="mt-1 text-xs font-bold text-[#ff8098]">{nameError}</p>}
                </div>
                <Button type="submit" size="sm" variant="primary">
                  + Squadra
                </Button>
              </form>
            )}
            {teamsReq.error && <InfoNote tone="danger">{teamsReq.error}</InfoNote>}
          </div>
        )}
      </div>
    </Panel>
  );
}

"use client";

import { useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Modal, Panel, Select, Toggle, useToast } from "@/components/ui";
import { useAdminMe, useCan, type AdminRole } from "@/features/admin/AdminShell";
import { errorMessage, fieldErrors, send, useApi } from "../api";
import { Checkbox, ErrorBlock, InfoNote, LinkButton, LoadingBlock, PageHeader } from "../common";
import { fmtDateTime, fmtStamp } from "../format";
import type { AdminUser, GlobalSettings, SessionSummary } from "../types";

const ROLE_LABEL: Record<AdminRole, string> = { operator: "Operatore", admin: "Admin", super_admin: "Super Admin" };
const ROLE_HINT: Record<AdminRole, string> = {
  operator: "Conduce solo le serate assegnate dalla regia live",
  admin: "Gestisce serate, domande, media, eventi e classifiche",
  super_admin: "Come admin, più impostazioni globali e utenti",
};

function GlobalSettingsForm({ initial, canEdit, onSaved }: { initial: GlobalSettings; canEdit: boolean; onSaved: (s: GlobalSettings) => void }) {
  const toast = useToast();
  const [s, setS] = useState<GlobalSettings>(initial);
  const [placement, setPlacement] = useState(initial.leaderboard.placementPoints.join(", "));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dis = !canEdit;

  function num<K extends keyof GlobalSettings>(group: K, key: keyof GlobalSettings[K], v: string) {
    setS((p) => ({ ...p, [group]: { ...p[group], [key]: v === "" ? 0 : Number(v) } }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const pts = placement
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map(Number);
    if (pts.length === 0 || pts.some((n) => !Number.isInteger(n) || n < 0)) {
      setErrors({ "leaderboard.placementPoints": "Inserisci numeri interi separati da virgola, es. 25, 18, 15" });
      return;
    }
    setSaving(true);
    setErrors({});
    setError(null);
    try {
      const body: GlobalSettings = { ...s, leaderboard: { ...s.leaderboard, placementPoints: pts } };
      const r = await send<{ settings: GlobalSettings }>("/api/admin/settings", "PUT", body);
      toast("ok", "Impostazioni globali salvate");
      onSaved(r.settings);
    } catch (err) {
      const fe = fieldErrors(err);
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(fe)) mapped[k.replace(/\.\d+$/, "")] = v;
      setErrors(mapped);
      setError(Object.keys(mapped).length ? "Controlla i campi evidenziati" : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const e = (k: string) => errors[k] ?? null;
  return (
    <form onSubmit={save} className="space-y-4">
      {!canEdit && <InfoNote>Solo il Super Admin può modificare le impostazioni globali.</InfoNote>}
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 font-bold text-white/85">Punteggio predefinito</legend>
        <Field label="Punti risposta corretta" error={e("scoring.correctPoints")}>
          {(id) => <Input id={id} type="number" min={0} max={100000} disabled={dis} value={s.scoring.correctPoints} onChange={(ev) => num("scoring", "correctPoints", ev.target.value)} />}
        </Field>
        <Field label="Penalità errata" error={e("scoring.wrongPenalty")}>
          {(id) => <Input id={id} type="number" min={0} max={100000} disabled={dis} value={s.scoring.wrongPenalty} onChange={(ev) => num("scoring", "wrongPenalty", ev.target.value)} />}
        </Field>
        <Field label="Penalità senza risposta" error={e("scoring.noAnswerPenalty")}>
          {(id) => <Input id={id} type="number" min={0} max={100000} disabled={dis} value={s.scoring.noAnswerPenalty} onChange={(ev) => num("scoring", "noAnswerPenalty", ev.target.value)} />}
        </Field>
        <div className="flex items-end pb-2">
          <Toggle checked={s.scoring.allowNegative} disabled={dis} onChange={(v) => setS({ ...s, scoring: { ...s.scoring, allowNegative: v } })} label="Punteggi sotto zero" />
        </div>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 font-bold text-white/85">Tempi</legend>
        <Field label="Secondi per rispondere" error={e("timing.defaultDurationSeconds")}>
          {(id) => <Input id={id} type="number" min={3} max={120} disabled={dis} value={s.timing.defaultDurationSeconds} onChange={(ev) => num("timing", "defaultDurationSeconds", ev.target.value)} />}
        </Field>
        <Field label="Tolleranza rete (ms)" error={e("timing.answerGraceMs")} hint="Margine per risposte arrivate al limite (0–2000)">
          {(id) => <Input id={id} type="number" min={0} max={2000} disabled={dis} value={s.timing.answerGraceMs} onChange={(ev) => num("timing", "answerGraceMs", ev.target.value)} />}
        </Field>
        <Field label="Secondi per votare" error={e("timing.defaultVoteSeconds")}>
          {(id) => <Input id={id} type="number" min={5} max={120} disabled={dis} value={s.timing.defaultVoteSeconds} onChange={(ev) => num("timing", "defaultVoteSeconds", ev.target.value)} />}
        </Field>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 font-bold text-white/85">Giocatori e classifiche</legend>
        <Field label="Nickname: lunghezza minima" error={e("players.nicknameMinLength")}>
          {(id) => <Input id={id} type="number" min={1} max={4} disabled={dis} value={s.players.nicknameMinLength} onChange={(ev) => num("players", "nicknameMinLength", ev.target.value)} />}
        </Field>
        <Field label="Nickname: lunghezza massima" error={e("players.nicknameMaxLength")}>
          {(id) => <Input id={id} type="number" min={4} max={24} disabled={dis} value={s.players.nicknameMaxLength} onChange={(ev) => num("players", "nicknameMaxLength", ev.target.value)} />}
        </Field>
        <Field label="Classifica mensile" error={e("leaderboard.monthlyAggregation")}>
          {(id) => (
            <Select
              id={id}
              disabled={dis}
              value={s.leaderboard.monthlyAggregation}
              onChange={(ev) => setS({ ...s, leaderboard: { ...s.leaderboard, monthlyAggregation: ev.target.value as GlobalSettings["leaderboard"]["monthlyAggregation"] } })}
            >
              <option value="sum_points">Somma dei punti</option>
              <option value="placement_points">Punti piazzamento</option>
            </Select>
          )}
        </Field>
        <Field label="Punti piazzamento (1°, 2°, …)" error={e("leaderboard.placementPoints")}>
          {(id) => <Input id={id} disabled={dis} value={placement} onChange={(ev) => setPlacement(ev.target.value)} />}
        </Field>
      </fieldset>
      <Toggle
        checked={s.events.autoEventsEnabled}
        disabled={dis}
        onChange={(v) => setS({ ...s, events: { autoEventsEnabled: v } })}
        label="Eventi di Palmino programmati automatici (interruttore generale)"
      />
      <p className="text-xs text-white/50">Le serate già pubblicate mantengono i punteggi congelati al momento della pubblicazione.</p>
      {error && <InfoNote tone="danger">{error}</InfoNote>}
      {canEdit && (
        <Button type="submit" variant="gold" loading={saving}>
          Salva impostazioni
        </Button>
      )}
    </form>
  );
}

function UserModal({ user, sessions, onClose, onSaved }: { user: AdminUser | null; sessions: SessionSummary[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const me = useAdminMe();
  const [email, setEmail] = useState(user?.email ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [role, setRole] = useState<AdminRole>(user?.role ?? "operator");
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState("");
  const [assigned, setAssigned] = useState<string[]>(user?.sessions ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const self = user?.userId === me.userId;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user && password.length < 10) {
      setErrors({ password: "Almeno 10 caratteri" });
      return;
    }
    if (user && password && password.length < 10) {
      setErrors({ password: "Almeno 10 caratteri" });
      return;
    }
    setSaving(true);
    setErrors({});
    setError(null);
    try {
      if (user) {
        await send(`/api/admin/users/${user.userId}`, "PATCH", {
          displayName: displayName.trim(),
          ...(self ? {} : { role, active }),
          ...(password ? { password } : {}),
          sessions: assigned,
        });
      } else {
        const r = await send<{ userId: string }>("/api/admin/users", "POST", { email: email.trim(), displayName: displayName.trim(), role, password });
        if (assigned.length) await send(`/api/admin/users/${r.userId}`, "PATCH", { sessions: assigned });
      }
      toast("ok", user ? "Utente aggiornato" : "Utente creato");
      onSaved();
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setError(Object.keys(fe).length ? "Controlla i campi evidenziati" : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const assignable = sessions.filter((s) => s.status !== "archived" && s.status !== "finished");
  return (
    <Modal
      open
      onClose={onClose}
      title={user ? `Modifica ${user.displayName}` : "Nuovo utente della regia"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" type="submit" form="user-form" loading={saving}>
            Salva
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={save} className="space-y-3">
        {!user && (
          <Field label="Email" error={errors.email}>
            {(id) => <Input id={id} type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        )}
        <Field label="Nome visualizzato" error={errors.displayName}>
          {(id) => <Input id={id} required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
        </Field>
        <Field label="Ruolo" error={errors.role} hint={self ? "Non puoi cambiare il ruolo del tuo account" : ROLE_HINT[role]}>
          {(id) => (
            <Select id={id} disabled={self} value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              {(Object.keys(ROLE_LABEL) as AdminRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={user ? "Nuova password (facoltativa)" : "Password iniziale"} error={errors.password} hint="Almeno 10 caratteri">
          {(id) => <Input id={id} type="password" autoComplete="new-password" required={!user} value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        {user && !self && <Toggle checked={active} onChange={setActive} label="Account attivo" />}
        {role === "operator" && (
          <fieldset>
            <legend className="mb-1 text-sm font-bold text-white/80">Serate che può condurre</legend>
            {assignable.length === 0 ? (
              <p className="text-sm text-white/55">Nessuna serata in programma.</p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 p-2">
                {assignable.map((s) => (
                  <Checkbox
                    key={s.id}
                    checked={assigned.includes(s.id)}
                    onChange={(c) => setAssigned((p) => (c ? [...p, s.id] : p.filter((x) => x !== s.id)))}
                    label={s.title}
                    hint={fmtDateTime(s.scheduledAt)}
                  />
                ))}
              </div>
            )}
          </fieldset>
        )}
        {error && <InfoNote tone="danger">{error}</InfoNote>}
      </form>
    </Modal>
  );
}

function UsersPanel() {
  const me = useAdminMe();
  const users = useApi<{ users: AdminUser[] }>("/api/admin/users");
  const sessions = useApi<{ sessions: SessionSummary[] }>("/api/admin/sessions");
  const [modal, setModal] = useState<{ user: AdminUser | null } | null>(null);
  const list = users.data?.users ?? [];
  const titleOf = (id: string) => sessions.data?.sessions.find((s) => s.id === id)?.title ?? "serata";

  return (
    <Panel
      title="Utenti della regia"
      actions={
        <Button size="sm" variant="gold" onClick={() => setModal({ user: null })}>
          + Nuovo utente
        </Button>
      }
    >
      {users.error ? (
        <ErrorBlock message={users.error} onRetry={users.reload} />
      ) : !users.data ? (
        <LoadingBlock />
      ) : list.length === 0 ? (
        <EmptyState title="Nessun utente" />
      ) : (
        <ul className="divide-y divide-white/10">
          {list.map((u) => (
            <li key={u.userId} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {u.displayName} {u.userId === me.userId && <span className="text-xs font-normal text-white/50">(tu)</span>}
                </p>
                <p className="truncate text-sm text-white/55">{u.email}</p>
                {u.role === "operator" && (
                  <p className="text-xs text-white/50">{u.sessions.length ? `Serate: ${u.sessions.map(titleOf).join(", ")}` : "Nessuna serata assegnata"}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={u.role === "super_admin" ? "gold" : u.role === "admin" ? "blue" : "gray"}>{ROLE_LABEL[u.role]}</Badge>
                {!u.active && <Badge color="red">Disattivato</Badge>}
                <span className="hidden text-xs text-white/40 md:inline">dal {fmtStamp(u.createdAt).slice(0, 8)}</span>
                <Button size="sm" variant="ghost" onClick={() => setModal({ user: u })}>
                  Modifica
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {modal && (
        <UserModal
          user={modal.user}
          sessions={sessions.data?.sessions ?? []}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            users.reload();
          }}
        />
      )}
    </Panel>
  );
}

export function SettingsPage() {
  const isSuper = useCan("super_admin");
  const req = useApi<{ settings: GlobalSettings }>("/api/admin/settings");
  const [savedAt, setSavedAt] = useState(0);
  return (
    <div className="space-y-5">
      <PageHeader title="Impostazioni" subtitle="Regole predefinite, utenti e backup" />
      <Panel title="Regole predefinite">
        {req.error ? (
          <ErrorBlock message={req.error} onRetry={req.reload} />
        ) : !req.data ? (
          <LoadingBlock />
        ) : (
          <GlobalSettingsForm
            key={savedAt}
            initial={req.data.settings}
            canEdit={isSuper}
            onSaved={(s) => {
              req.setData({ settings: s });
              setSavedAt((n) => n + 1);
            }}
          />
        )}
      </Panel>

      {isSuper ? <UsersPanel /> : <InfoNote>La gestione degli utenti della regia è riservata al Super Admin.</InfoNote>}

      <Panel title="Backup e ripristino">
        <div className="space-y-3 text-sm text-white/75">
          <p>
            <strong className="text-white">Backup di una serata.</strong> Da ogni serata pubblicata o conclusa usa il pulsante <em>Backup JSON</em>: scarica round,
            domande congelate, giocatori, risposte, punteggi, voti ed eventi. Conserva il file dopo ogni serata importante.
          </p>
          <p>
            <strong className="text-white">Backup completo del database.</strong> Sul server di produzione esegui <code className="rounded bg-white/10 px-1">npm run db:backup</code>{" "}
            (salva una copia completa di tutte le tabelle) oppure usa i backup automatici giornalieri dalla dashboard di Supabase (Database → Backups).
          </p>
          <p>
            <strong className="text-white">Domande.</strong> Dall&apos;archivio domande puoi esportare tutto in JSON o CSV: lo stesso file si può reimportare in
            qualsiasi momento.
          </p>
          <p>
            <strong className="text-white">Ripristino.</strong> Il ripristino completo si fa dalla dashboard di Supabase (point-in-time o backup giornaliero) o
            reimportando il dump con gli strumenti di PostgreSQL; le domande si reimportano dalla pagina Importa. Prima di un ripristino avvisa chi sta usando la
            regia: le serate in corso verrebbero interrotte.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <LinkButton href="/api/admin/questions/export?format=json" size="sm" download>
              ⬇ Esporta domande JSON
            </LinkButton>
            <LinkButton href="/admin/sessions" size="sm">
              Vai alle serate
            </LinkButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

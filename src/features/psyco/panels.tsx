"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { RULE_TEXT_MAX, DIFFICULTY_LABEL, type DifficultyChoice, type PsycoAction, type PsycoView, type SecretRule } from "@/lib/psyco/types";
import { ApiError } from "@/lib/realtime/api-client";
import { psycoAct } from "./use-psyco";
import { Lens, RuleCard } from "./ui";

/** Azioni con stato "in corso" ed errori leggibili. STALE_BALLOT (votazione già decisa) = solo un aggiornamento. */
export function useActions(roomId: string, onView: (v: PsycoView) => void, refresh: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(action: PsycoAction, as?: string | null): Promise<boolean> {
    setBusy(action.action);
    setError(null);
    try {
      const r = await psycoAct(roomId, action, as);
      if ("state" in r) onView(r);
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.code === "STALE_BALLOT" || e.code === "WRONG_PHASE")) {
        refresh();
        return false;
      }
      setError(e instanceof ApiError ? e.message : "Qualcosa è andato storto, riprova");
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { run, busy, error, clearError: () => setError(null) };
}

export function ErrorNote({ error, onClose }: { error: string | null; onClose?: () => void }) {
  if (!error) return null;
  return (
    <p role="alert" className="psy-shake flex items-center justify-between gap-3 rounded-2xl bg-blood/25 px-4 py-3 text-sm font-bold text-[#ffd8da] ring-1 ring-blood/50">
      {error}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Chiudi" className="text-lg">
          ✕
        </button>
      )}
    </p>
  );
}

/** Schermata per lo PSYCO mentre gli altri scelgono la regola. */
export function DontLook({ title = "NON GUARDARE!", sub }: { title?: string; sub: string }) {
  return (
    <section className="psy-rise flex flex-col items-center gap-5 text-center">
      <Lens className="h-32 w-32 psy-flicker" />
      <h2 className="psy-title text-6xl md:text-7xl">{title}</h2>
      <p className="psy-type max-w-md text-xl text-paper/90">{sub}</p>
    </section>
  );
}

const DIFF: { v: DifficultyChoice; hint: string }[] = [
  { v: "facile", hint: "Si nota presto" },
  { v: "media", hint: "Ci vuole attenzione" },
  { v: "difficile", hint: "Per detective veri" },
  { v: "sorpresa", hint: "Decide il caso" },
];

export function DifficultyVote({ myVote, onVote, busy }: { myVote: string | null; onVote: (c: DifficultyChoice) => void; busy: boolean }) {
  return (
    <section className="flex w-full max-w-md flex-col gap-3">
      <h2 className="psy-display text-center text-4xl text-paper">Che difficoltà?</h2>
      <p className="text-center font-bold text-paper/75">Decidete insieme: vince la scelta con più voti.</p>
      <div className="grid grid-cols-2 gap-3">
        {DIFF.map((d) => (
          <button
            key={d.v}
            type="button"
            disabled={busy}
            aria-pressed={myVote === d.v}
            onClick={() => onVote(d.v)}
            className={clsx("rounded-2xl p-4 text-left transition active:scale-[0.97]", myVote === d.v ? "psy-paper" : "bg-white/6 ring-1 ring-white/15 hover:bg-white/12")}
          >
            <span className={clsx("psy-display block text-3xl", myVote === d.v ? "text-[#8e0b12]" : "text-paper")}>{DIFFICULTY_LABEL[d.v]}</span>
            <span className={clsx("text-sm font-bold", myVote === d.v ? "text-[#4a3220]" : "text-paper/70")}>{d.hint}</span>
          </button>
        ))}
      </div>
      {myVote && <p className="text-center text-sm font-bold text-paper/70">Voto registrato: puoi cambiarlo finché la votazione è aperta.</p>}
    </section>
  );
}

export function CandidateVote({ candidate, myVote, onVote, busy, shown }: { candidate: SecretRule; myVote: string | null; onVote: (c: "yes" | "no") => void; busy: boolean; shown: number }) {
  return (
    <section className="flex w-full max-w-xl flex-col items-center gap-4">
      <p className="psy-type text-paper/70">Regola proposta n. {shown}</p>
      <RuleCard rule={candidate} className="w-full" label="regola proposta" />
      <div className="grid w-full grid-cols-2 gap-3">
        <button type="button" disabled={busy} aria-pressed={myVote === "yes"} onClick={() => onVote("yes")} className={clsx("psy-btn", myVote === "yes" && "ring-4 ring-lamp")}>
          SÌ, QUESTA!
        </button>
        <button type="button" disabled={busy} aria-pressed={myVote === "no"} onClick={() => onVote("no")} className={clsx("psy-btn psy-btn-ghost", myVote === "no" && "ring-4 ring-lamp")}>
          UN&apos;ALTRA
        </button>
      </div>
      <p className="text-center text-sm font-bold text-paper/70">Serve la maggioranza: senza accordo arriva un&apos;altra regola.</p>
    </section>
  );
}

export function ProposalForm({
  myProposal,
  myPassed,
  others,
  onPropose,
  onPass,
  busy,
}: {
  myProposal: { id: string; text: string } | null;
  myPassed: boolean;
  others: { id: string; text: string; mine: boolean }[];
  onPropose: (text: string) => Promise<boolean>;
  onPass: () => void;
  busy: boolean;
}) {
  const [text, setText] = useState(myProposal?.text ?? "");
  const [editing, setEditing] = useState(!myProposal);
  const left = RULE_TEXT_MAX - text.length;
  return (
    <section className="flex w-full max-w-xl flex-col gap-4">
      <h2 className="psy-display text-center text-4xl text-paper">Inventate la regola</h2>
      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void onPropose(text).then((ok) => ok && setEditing(false));
          }}
        >
          <label htmlFor="psy-proposal" className="font-bold text-paper/80">
            Una regola che tutti possano seguire mentre rispondono allo PSYCO. Più è subdola, meglio è.
          </label>
          <textarea
            id="psy-proposal"
            className="psy-input min-h-28 resize-none"
            maxLength={RULE_TEXT_MAX}
            placeholder="Es. Ogni volta che lo PSYCO fa una domanda, tutti rispondono con una parola che inizia con la S."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-between text-xs font-bold text-paper/60">
            <span>Niente nomi offensivi: la vedranno tutti a fine manche.</span>
            <span aria-live="polite">{left} caratteri</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <button type="submit" className="psy-btn" disabled={busy || text.trim().length < 8}>
              {myProposal ? "AGGIORNA" : "PROPONI"}
            </button>
            {!myProposal && !myPassed && (
              <button type="button" className="psy-btn psy-btn-ghost text-lg" disabled={busy} onClick={onPass}>
                Passo
              </button>
            )}
          </div>
          {myPassed && <p className="text-center text-sm font-bold text-paper/70">Hai passato: puoi ancora proporre finché le proposte sono aperte.</p>}
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <RuleCard rule={{ title: null, text: myProposal?.text ?? text, difficulty: null }} label="la tua proposta" className="w-full" />
          <button type="button" className="psy-chip" onClick={() => setEditing(true)}>
            Modifica
          </button>
        </div>
      )}
      {others.filter((o) => !o.mine).length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-extrabold uppercase tracking-wider text-paper/60">Proposte degli altri</p>
          {others
            .filter((o) => !o.mine)
            .map((o) => (
              <p key={o.id} className="psy-type rounded-xl bg-white/6 px-4 py-3 text-paper">
                {o.text}
              </p>
            ))}
        </div>
      )}
    </section>
  );
}

export function ProposalVote({
  proposals,
  runoff,
  myVote,
  onVote,
  busy,
}: {
  proposals: { id: string; text: string; mine: boolean }[];
  runoff: string[] | null;
  myVote: string | null;
  onVote: (id: string) => void;
  busy: boolean;
}) {
  const list = runoff ? proposals.filter((p) => runoff.includes(p.id)) : proposals;
  return (
    <section className="flex w-full max-w-xl flex-col gap-3">
      <h2 className="psy-display text-center text-4xl text-paper">{runoff ? "Spareggio!" : "Votate la regola migliore"}</h2>
      {runoff && <p className="text-center font-bold text-lamp">Parità: si rivota solo tra le proposte pari merito. Se resta la parità decide il sorteggio.</p>}
      <ul className="flex flex-col gap-3">
        {list.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={busy}
              aria-pressed={myVote === p.id}
              onClick={() => onVote(p.id)}
              className={clsx("w-full rounded-2xl p-4 text-left transition active:scale-[0.99]", myVote === p.id ? "psy-paper" : "bg-white/6 ring-1 ring-white/15 hover:bg-white/12")}
            >
              <span className={clsx("text-xs font-black uppercase tracking-widest", myVote === p.id ? "text-[#8e0b12]" : "text-paper/60")}>
                Proposta {i + 1}
                {p.mine ? " · tua" : ""}
              </span>
              <span className={clsx("psy-type mt-1 block text-lg", myVote === p.id ? "text-[#2a1a10]" : "text-paper")}>{p.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GuessVote({ psycoName, myVote, onVote, busy, runoff }: { psycoName: string; myVote: string | null; onVote: (c: "yes" | "no") => void; busy: boolean; runoff: boolean }) {
  return (
    <section className="flex w-full max-w-md flex-col items-center gap-4 text-center">
      <h2 className="psy-title text-5xl md:text-6xl">HA INDOVINATO?</h2>
      <p className="psy-type text-lg text-paper/90">
        {psycoName} spiega a voce la regola. Giudicate voi: serve la maggioranza.{runoff ? " Parità: si vota di nuovo, poi vale il «no»." : ""}
      </p>
      <div className="grid w-full grid-cols-2 gap-3">
        <button type="button" disabled={busy} aria-pressed={myVote === "yes"} onClick={() => onVote("yes")} className={clsx("psy-btn", myVote === "yes" && "ring-4 ring-lamp")}>
          SÌ, ESATTO
        </button>
        <button type="button" disabled={busy} aria-pressed={myVote === "no"} onClick={() => onVote("no")} className={clsx("psy-btn psy-btn-ghost", myVote === "no" && "ring-4 ring-lamp")}>
          NO
        </button>
      </div>
    </section>
  );
}

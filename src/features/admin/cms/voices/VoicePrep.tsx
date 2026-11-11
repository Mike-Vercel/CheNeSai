"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, useConfirm, useToast } from "@/components/ui";
import type { PregenBatchResult, PregenProgress, PregenScope } from "@/lib/server/tts-pregen";
import { api } from "@/lib/realtime/api-client";
import { errorMessage, send } from "../api";
import { InfoNote } from "../common";
import { fmtNum, plural } from "../format";

/** Caratteri stimati per una domanda (testo + risposte + rivelazione): ~200. */
export const CHARS_PER_QUESTION_HINT = 200;

const BATCH = 4;

export function estimatePregen(scope: PregenScope): Promise<PregenProgress> {
  return send<PregenProgress>("/api/admin/tts/pregen", "POST", { action: "estimate", scope });
}

interface Job {
  label: string;
  progress: PregenProgress;
  startMissing: number;
  generated: number;
  billed: number;
  running: boolean;
  error: string | null;
}

/**
 * Prepara le voci di un ambito a piccoli lotti: stima → conferma (caratteri e budget) → ciclo di richieste.
 * Nulla viene generato senza la conferma esplicita.
 */
export function usePregen(onDone?: () => void) {
  const confirm = useConfirm();
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const cancelRef = useRef(false);

  const prepare = useCallback(
    async (scope: PregenScope, label: string): Promise<boolean> => {
      let est: PregenProgress;
      try {
        est = await estimatePregen(scope);
      } catch (e) {
        toast("error", errorMessage(e));
        return false;
      }
      if (!est.configured) {
        toast("error", "ElevenLabs non è configurato (ELEVENLABS_API_KEY): il TV usa la voce del browser");
        return false;
      }
      if (est.missing === 0) {
        toast("ok", `${label}: tutte le ${est.total} battute sono già pronte`);
        return true;
      }
      const over = est.missingChars > est.remainingBudget;
      const ok = await confirm({
        title: "Generare le voci con ElevenLabs?",
        message: (
          <div className="space-y-2 text-sm">
            <p>
              <strong>{label}</strong>: {est.ready}/{est.total} battute già pronte. Ne mancano <strong>{est.missing}</strong>, per circa{" "}
              <strong>{fmtNum(est.missingChars)} caratteri</strong> (modello di qualità).
            </p>
            <p>
              Budget voci dell&apos;app questo mese: usati {fmtNum(est.monthChars)} su {fmtNum(est.budget)} · restano <strong>{fmtNum(est.remainingBudget)}</strong>.
            </p>
            {over && <p className="text-[#ffe9a3]">Il budget non basta per tutto: la generazione si fermerà quando sarà esaurito.</p>}
            {est.noVoice > 0 && <p className="text-[#ffe9a3]">{plural(est.noVoice, "battuta non ha", "battute non hanno")} una voce assegnata e verranno saltate.</p>}
            <p className="text-white/60">Ogni battuta si paga una volta sola: resta in archivio e vale per tutte le serate.</p>
          </div>
        ),
        confirmLabel: `Genera ${fmtNum(est.missingChars)} caratteri`,
      });
      if (!ok) return false;

      cancelRef.current = false;
      let state: Job = { label, progress: est, startMissing: est.missing, generated: 0, billed: 0, running: true, error: null };
      setJob(state);
      let stalls = 0;
      let failures = 0;
      while (!cancelRef.current) {
        let r: PregenBatchResult;
        try {
          // Un lotto può durare decine di secondi (modello di qualità): timeout ampio.
          r = await api<PregenBatchResult>("/api/admin/tts/pregen", { method: "POST", json: { action: "run", scope, batch: BATCH }, timeoutMs: 65_000 });
          failures = 0;
        } catch (e) {
          // errore transitorio (rete, server occupato): si riprova un paio di volte; le clip già fatte restano
          if (++failures <= 2 && !cancelRef.current) continue;
          state = { ...state, running: false, error: errorMessage(e) };
          break;
        }
        state = { ...state, progress: r, generated: state.generated + r.generated, billed: state.billed + r.billedChars };
        if (r.blocked) {
          state = { ...state, running: false, error: "Budget mensile delle voci esaurito: le battute mancanti useranno la voce del browser." };
          break;
        }
        if (r.missing === 0) break;
        stalls = r.generated === 0 ? stalls + 1 : 0;
        if (stalls >= 2) {
          state = { ...state, running: false, error: r.errors[0] ?? "Generazione bloccata" };
          break;
        }
        setJob(state);
      }
      state = { ...state, running: false };
      setJob(state);
      if (!state.error) toast("ok", cancelRef.current ? "Generazione interrotta" : `${label}: voci pronte (${fmtNum(state.billed)} caratteri spesi)`);
      onDone?.();
      return !state.error;
    },
    [confirm, toast, onDone],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const modal = job ? <PregenProgressModal job={job} onCancel={cancel} onClose={() => setJob(null)} /> : null;
  return { prepare, running: !!job?.running, modal };
}

function PregenProgressModal({ job, onCancel, onClose }: { job: Job; onCancel: () => void; onClose: () => void }) {
  const p = job.progress;
  const pct = p.total > 0 ? Math.round((p.ready / p.total) * 100) : 100;
  return (
    <Modal
      open
      onClose={job.running ? onCancel : onClose}
      title={`Voci · ${job.label}`}
      footer={
        job.running ? (
          <Button variant="ghost" onClick={onCancel}>
            Interrompi
          </Button>
        ) : (
          <Button variant="gold" onClick={onClose}>
            Chiudi
          </Button>
        )
      }
    >
      <div className="space-y-3 text-sm">
        <div className="h-4 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-[#5dffab] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="font-bold">
          {p.ready}/{p.total} battute pronte ({pct}%){job.running && " · generazione in corso…"}
        </p>
        <p className="text-white/70">
          Generate ora: {job.generated} · caratteri spesi: {fmtNum(job.billed)} · budget rimasto: {fmtNum(p.remainingBudget)}
        </p>
        {job.error && <InfoNote tone="danger">{job.error}</InfoNote>}
      </div>
    </Modal>
  );
}

/** Riquadro "Voci della serata: 38/40 pronte · stima X caratteri" con il pulsante Prepara voci. */
export function VoicePrepBox({ scope, title, label, hint }: { scope: PregenScope; title: string; label: string; hint?: string }) {
  const [est, setEst] = useState<PregenProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const scopeKey = JSON.stringify(scope);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const { prepare, running, modal } = usePregen(reload);

  useEffect(() => {
    let alive = true;
    estimatePregen(JSON.parse(scopeKey) as PregenScope)
      .then((r) => {
        if (!alive) return;
        setEst(r);
        setError(null);
      })
      .catch((e: unknown) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [scopeKey, nonce]);

  const done = est && est.missing === 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#140822] p-3" data-testid="voice-prep">
      <p className="text-sm font-bold text-white/90">
        🎙️ {title}:{" "}
        {error ? (
          <span className="text-[#ffc2cd]">{error}</span>
        ) : !est ? (
          <span className="text-white/50">calcolo…</span>
        ) : (
          <>
            <span className={done ? "text-[#5dffab]" : "text-gold"}>
              {est.ready}/{est.total} pronte
            </span>
            {!done && <span className="text-white/70"> · stima {fmtNum(est.missingChars)} caratteri</span>}
          </>
        )}
      </p>
      {est && !est.configured && <p className="mt-1 text-xs text-white/55">ElevenLabs non configurato: il TV userà la voce del browser.</p>}
      {est && est.configured && (
        <p className="mt-1 text-xs text-white/55">
          Budget del mese: restano {fmtNum(est.remainingBudget)} su {fmtNum(est.budget)} caratteri.{hint ? ` ${hint}` : ""}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant={done ? "ghost" : "gold"} disabled={!est || !est.configured || running || !!done} loading={running} onClick={() => void prepare(scope, label)}>
          {done ? "✓ Voci pronte" : "Prepara voci"}
        </Button>
        <Button size="sm" variant="ghost" onClick={reload}>
          Aggiorna
        </Button>
      </div>
      {modal}
    </div>
  );
}

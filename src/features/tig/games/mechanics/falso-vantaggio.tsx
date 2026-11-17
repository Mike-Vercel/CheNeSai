"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { FalsoReveal, FalsoSubmission, FalsoView } from "@/lib/tig/games/mechanics/falso-vantaggio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<FalsoView, null, FalsoSubmission, FalsoReveal>;
type T = TvGameProps<FalsoView, FalsoReveal>;
type Busta = FalsoSubmission["busta"];

/** Busta disegnata: chiusa col sigillo, aperta col valore. */
function Envelope({ label, value, open, tone, className }: { label: string; value: string; open: boolean; tone: "lime" | "red"; className?: string }) {
  const c = tone === "lime" ? "var(--tg-gold)" : "var(--tg-red-hi)";
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-label={`Busta ${label}: ${open ? value : "chiusa"}`}>
      <rect x="8" y="30" width="144" height="84" rx="8" fill="var(--tg-night-2)" stroke={c} strokeWidth="3" />
      {open ? (
        <>
          <path d="M8 38 L80 6 L152 38" fill="var(--tg-raised)" stroke={c} strokeWidth="3" strokeLinejoin="round" />
          <rect x="26" y="20" width="108" height="56" rx="6" fill="var(--tg-cream)" />
          <text x="80" y="60" textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--tg-ink)" fontFamily="var(--tg-display), Impact, sans-serif">
            {value}
          </text>
        </>
      ) : (
        <>
          <path d="M8 38 L80 82 L152 38" fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="80" cy="80" r="13" fill={c} />
          <text x="80" y="86" textAnchor="middle" fontSize="17" fontWeight="800" fill="var(--tg-ink)" fontFamily="var(--tg-display), Impact, sans-serif">
            ?
          </text>
        </>
      )}
      <text x="80" y="108" textAnchor="middle" fontSize="13" fontWeight="800" fill={c} letterSpacing="2" fontFamily="var(--tg-body), sans-serif">
        {label}
      </text>
    </svg>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [busta, setBusta] = useState<Busta | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = busta === "subito" || (busta === "enigma" && !!picked);
  const submit = () => {
    if (!ready || !p.canSubmit) return;
    send(busta === "subito" ? { busta: "subito" } : { busta: "enigma", optionId: picked! });
  };
  const sub = view.subitoRange;
  const eni = view.enigmaRange;

  if (p.stage === "reveal" && reveal) {
    const s = reveal.summary;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="grid grid-cols-2 gap-3">
          <Envelope label="SUBITO" value={reveal.subitoPrize === null ? "?" : String(reveal.subitoPrize)} open tone="lime" className="w-full" />
          <Envelope label="ENIGMA" value={reveal.enigmaPrize === null ? "?" : String(reveal.enigmaPrize)} open tone="red" className="w-full" />
          {s && (
            <p className="col-span-2 text-center text-sm font-bold text-(--tg-cream)/75">
              SUBITO scelta da {s.subito} · ENIGMA da {s.enigma}, risolta da {s.solved}
            </p>
          )}
        </Panel>
        <Panel className="flex flex-col gap-2">
          <Eyebrow>L&apos;enigma nella busta</Eyebrow>
          <p className="text-base font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={view.options} picked={sent && busta === "enigma" && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={busta === "subito" ? "Prendo SUBITO" : busta === "enigma" ? "Rispondo e apro" : "Scegliete una busta"} hint={busta === "enigma" && !picked ? "Rispondete all'enigma della busta" : undefined} />}
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Busta">
        {(
          [
            ["subito", "SUBITO", `Premio certo, coperto: ${sub.join(", ")} (uno su ${sub.length})`, "lime"],
            ["enigma", "ENIGMA", `${eni.join(", ")} (uno su ${eni.length}) solo se risolvete l'enigma, sennò 0`, "red"],
          ] as const
        ).map(([id, label, text, tone]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={busta === id}
            disabled={!editable}
            onClick={() => setBusta(id)}
            className={clsx("flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-center transition-transform active:scale-[0.98]", busta === id ? (tone === "lime" ? "tg-picked border-(--tg-gold)" : "tg-picked border-(--tg-red-hi)") : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]")}
          >
            <Envelope label={label} value="" open={false} tone={tone} className="w-full max-w-[170px]" />
            <span className="text-sm font-bold leading-snug text-(--tg-cream)/85">{text}</span>
          </button>
        ))}
      </div>
      {busta === "enigma" ? (
        <Panel tone="red" className="tg-rise flex flex-col gap-2">
          <Eyebrow className="text-(--tg-red-hi)">Busta aperta: l&apos;enigma</Eyebrow>
          <p className="text-lg font-extrabold leading-snug">{view.prompt}</p>
          <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
        </Panel>
      ) : (
        <Panel className="flex items-center gap-3 text-base font-bold text-(--tg-cream)/75">
          <Icon name="eye" className="h-6 w-6 shrink-0" /> L&apos;enigma si vede solo aprendo la busta ENIGMA. I valori delle buste li scopre il reveal: sono uguali per tutti i tavoli.
        </Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Valori estratti per questa prova, uguali per tutti i tavoli" : "Due buste coperte: la certezza o l'enigma. Regole e probabilità sono queste, i valori si scoprono alla fine"}>
      <div className="grid h-full grid-cols-[1fr_1.2fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col items-center gap-[1cqw]">
          <div className="grid w-full grid-cols-2 gap-[1.2cqw]">
            <div className="flex flex-col items-center gap-[0.4cqw]">
              <Envelope label="SUBITO" value={done && reveal.subitoPrize !== null ? String(reveal.subitoPrize) : ""} open={!!done} tone="lime" className={clsx("w-full", done && "tg-pop")} />
              <p className="text-center text-[1.2cqw] font-bold text-(--tg-cream)/80">certo: {view.subitoRange.join(" · ")}</p>
              {s && <p className="tg-num text-[1.8cqw] text-(--tg-gold)">{s.subito} tavoli</p>}
            </div>
            <div className="flex flex-col items-center gap-[0.4cqw]">
              <Envelope label="ENIGMA" value={done && reveal.enigmaPrize !== null ? String(reveal.enigmaPrize) : ""} open={!!done} tone="red" className={clsx("w-full", done && "tg-pop")} />
              <p className="text-center text-[1.2cqw] font-bold text-(--tg-cream)/80">se risolto: {view.enigmaRange.join(" · ")}</p>
              {s && (
                <p className="tg-num text-[1.8cqw] text-(--tg-red-hi)">
                  {s.enigma} tavoli · {s.solved} giusti
                </p>
              )}
            </div>
          </div>
          {!done && <p className="mt-auto text-center text-[1.4cqw] font-bold text-(--tg-cream)/70">Ogni valore della stessa busta ha la stessa probabilità.</p>}
        </TvPanel>
        <TvPanel className="flex min-h-0 flex-col gap-[0.8cqw]">
          {done ? (
            <>
              <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-red-hi)">L&apos;enigma della busta</p>
              <p className="text-[1.9cqw] font-extrabold leading-tight">{reveal.prompt}</p>
              <div className="grid grid-cols-2 gap-[0.6cqw]">
                {view.options.map((o, i) => (
                  <TvOption key={o.id} size="sm" index={i} text={o.text} state={o.id === reveal.solutionId ? "right" : "dim"} />
                ))}
              </div>
              <TvExplain text={reveal.explain} className="mt-auto" />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-[1cqw] text-center">
              <Icon name="lock" className="h-[5cqw] w-[5cqw] text-(--tg-red-hi)" />
              <p className="tg-display text-[3cqw]">L&apos;enigma è chiuso nella busta</p>
              <p className="max-w-[40cqw] text-[1.5cqw] font-bold text-(--tg-cream)/70">Lo vede solo chi sceglie la busta ENIGMA, sul telefono. La TV lo mostra alla fine.</p>
            </div>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const falsoVantaggioUi = defineUi(Player, Tv);

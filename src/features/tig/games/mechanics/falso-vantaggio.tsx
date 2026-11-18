"use client";

import { clsx } from "clsx";
import { useId, useState } from "react";
import type { FalsoReveal, FalsoSubmission, FalsoView } from "@/lib/tig/games/mechanics/falso-vantaggio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { WaxSeal } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { tvCompact, TvLabel, TvWhy } from "./m2/kit";

type P = PlayerGameProps<FalsoView, null, FalsoSubmission, FalsoReveal>;
type T = TvGameProps<FalsoView, FalsoReveal>;
type Busta = FalsoSubmission["busta"];

/** Lettera di pergamena disegnata: chiusa col sigillo di ceralacca (oro = SUBITO, rosso = ENIGMA), aperta col valore. */
function Envelope({ label, value, open, tone, className }: { label: string; value: string; open: boolean; tone: "lime" | "red"; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const edge = tone === "lime" ? "#c9a24a" : "#c8312b";
  const [w1, w2, w3] = tone === "lime" ? ["#ffe08a", "#e9a92c", "#9a6216"] : ["#ea6a5f", "#c8312b", "#7e1a14"];
  return (
    <svg viewBox="0 0 160 124" className={className} role="img" aria-label={`Busta ${label}: ${open ? value : "chiusa"}`}>
      <defs>
        <linearGradient id={`${uid}-p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4e7c7" />
          <stop offset="1" stopColor="#d9c08a" />
        </linearGradient>
        <radialGradient id={`${uid}-s`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor={w1} />
          <stop offset="0.45" stopColor={w2} />
          <stop offset="1" stopColor={w3} />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="119" rx="64" ry="4" fill="#000" opacity="0.35" />
      {open && <path d="M10 36L80 4L150 36" fill="#e2cd9a" stroke="#8a5a2b" strokeWidth="2.2" strokeLinejoin="round" />}
      <rect x="10" y="34" width="140" height="80" rx="6" fill={`url(#${uid}-p)`} stroke={edge} strokeWidth="3" />
      <path d="M10 110L66 72M150 110L94 72" fill="none" stroke="#8a5a2b" strokeWidth="1.6" opacity="0.55" />
      {open && (
        <g>
          <rect x="26" y="10" width="108" height="76" rx="5" fill="#fbf3dc" stroke="#8a5a2b" strokeWidth="1.8" />
          <rect x="31" y="15" width="98" height="66" rx="3" fill="none" stroke={edge} strokeWidth="1.2" strokeDasharray="3 2.5" />
          <text x="80" y="62" textAnchor="middle" fontSize="40" fontWeight="900" fill="#1b1410" style={{ fontFamily: "var(--tg-display)", fontFeatureSettings: '"lnum" 1' }}>
            {value}
          </text>
        </g>
      )}
      {!open && (
        <>
          <path d="M10 38L80 82L150 38" fill="none" stroke="#8a5a2b" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="80" cy="80" r="15" fill={`url(#${uid}-s)`} stroke={w3} strokeWidth="1.5" />
          <text x="80" y="86.5" textAnchor="middle" fontSize="19" fontWeight="900" fill="#1b1410" opacity="0.8" style={{ fontFamily: "var(--tg-display)" }}>
            ?
          </text>
        </>
      )}
      <text x="80" y="106" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#1b1410" letterSpacing="2.2" style={{ fontFamily: "var(--tg-display)" }}>
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
        <Panel className="grid grid-cols-2 gap-3 sm:mx-auto sm:w-full sm:max-w-[460px]">
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
  const compact = tvCompact(p.teams);
  const tavoli = (n: number) => `${n} ${n === 1 ? "tavolo" : "tavoli"}`;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Valori estratti per questa prova, uguali per tutti i tavoli" : "Due buste coperte: la certezza o l'enigma. Regole e probabilità sono queste, i valori si scoprono alla fine"}>
      <div className="grid h-full grid-cols-[1fr_1.2fr] gap-[1.6cqw]">
        <TvPanel className={clsx("flex min-h-0 flex-col items-center justify-center", compact ? "gap-[0.6cqw] py-[1.2cqw]" : "gap-[1cqw]")}>
          <div className="grid w-full grid-cols-2 gap-[1.4cqw]">
            {(
              [
                ["SUBITO", "lime", done ? reveal.subitoPrize : null, `certo: ${view.subitoRange.join(" · ")}`, s ? tavoli(s.subito) : null],
                ["ENIGMA", "red", done ? reveal.enigmaPrize : null, `se risolto: ${view.enigmaRange.join(" · ")}`, s ? `${tavoli(s.enigma)} · ${s.solved} ${s.solved === 1 ? "giusto" : "giusti"}` : null],
              ] as const
            ).map(([label, tone, prize, rule, count]) => (
              <div key={label} className="flex min-w-0 flex-col items-center gap-[0.4cqw]">
                <Envelope label={label} value={prize === null ? "" : String(prize)} open={!!done} tone={tone} className={clsx(compact ? "w-[13cqw]" : "w-full", done && "tg-pop")} />
                <p className={clsx("text-center font-bold text-(--tg-cream)/85", compact ? "text-[1.1cqw]" : "text-[1.25cqw]")}>{rule}</p>
                {count && <p className={clsx("tg-num text-center", compact ? "text-[1.5cqw]" : "text-[1.8cqw]", tone === "lime" ? "text-(--tg-gold-hi)" : "text-(--tg-red-hi)")}>{count}</p>}
              </div>
            ))}
          </div>
          {!done && <p className={clsx("mt-[0.6cqw] text-center font-bold text-(--tg-cream)/75", compact ? "text-[1.2cqw]" : "text-[1.4cqw]")}>Ogni valore della stessa busta ha la stessa probabilità.</p>}
        </TvPanel>
        <TvPanel className={clsx("flex min-h-0 flex-col", compact ? "gap-[0.6cqw] py-[1.2cqw]" : "gap-[0.8cqw]")}>
          {done ? (
            <>
              <TvLabel className="text-(--tg-red-hi)" icon={<Icon name="eye" className="h-[1.5cqw] w-[1.5cqw]" />}>
                L&apos;enigma della busta
              </TvLabel>
              <p className={clsx("font-extrabold leading-tight", compact ? "text-[1.6cqw]" : "text-[1.9cqw]")}>{reveal.prompt}</p>
              <div className="grid grid-cols-2 gap-[0.6cqw]">
                {view.options.map((o, i) => (
                  <TvOption key={o.id} size="sm" index={i} text={o.text} state={o.id === reveal.solutionId ? "right" : "dim"} />
                ))}
              </div>
              <TvWhy text={reveal.explain} compact={compact} className="mt-auto" />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-[1cqw] text-center">
              <WaxSeal mark="x" className={compact ? "h-[6cqw] w-[6cqw]" : "h-[7.5cqw] w-[7.5cqw]"} />
              <p className={clsx("tg-title leading-none text-(--tg-cream)", compact ? "text-[2.6cqw]" : "text-[3.2cqw]")}>L&apos;enigma è sigillato nella busta</p>
              <p className={clsx("max-w-[40cqw] font-bold text-(--tg-cream)/80", compact ? "text-[1.3cqw]" : "text-[1.5cqw]")}>Lo vede solo chi sceglie la busta ENIGMA, sul telefono. La TV lo mostra alla fine.</p>
            </div>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const falsoVantaggioUi = defineUi(Player, Tv);

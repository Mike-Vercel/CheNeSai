"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { FraseMemberView, FraseReveal, FraseSubmission, FraseView, Mossa } from "@/lib/tig/games/mechanics/la-frase-a-meta";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { PactToggle, TableTag } from "./m4/kit";

type P = PlayerGameProps<FraseView, FraseMemberView, FraseSubmission, FraseReveal>;
type T = TvGameProps<FraseView, FraseReveal>;

/** Tabella dei punti, uguale per tutti e visibile prima della scelta. */
function Matrix({ view, tv = false }: { view: FraseView; tv?: boolean }) {
  const p = view.payoff;
  const cell = clsx("rounded-lg text-center font-bold leading-tight", tv ? "px-[0.6cqw] py-[0.5cqw] text-[1.2cqw]" : "px-2 py-1.5 text-sm");
  const head = clsx("text-center font-extrabold uppercase text-(--tg-cream)/60", tv ? "text-[0.9cqw] tracking-[0.12em]" : "text-[10px] tracking-[0.1em]");
  return (
    <div className={clsx("grid grid-cols-[auto_1fr_1fr] items-center", tv ? "gap-[0.5cqw]" : "gap-1.5")} role="table" aria-label="Punti per la vostra mossa">
      <span />
      <span className={head}>L&apos;altro condivide</span>
      <span className={head}>L&apos;altro inganna</span>
      <span className={clsx("tg-display", tv ? "text-[1.5cqw]" : "text-lg", "text-(--tg-gold)")}>Condivido</span>
      <span className={clsx(cell, "bg-(--tg-gold-dark)/80 text-(--tg-gold-hi)")}>+{p.patto}</span>
      <span className={clsx(cell, "bg-(--tg-cream)/[0.06]")}>ipotesi giusta +{p.ipotesi}</span>
      <span className={clsx("tg-display", tv ? "text-[1.5cqw]" : "text-lg", "text-(--tg-red-hi)")}>Inganno</span>
      <span className={clsx(cell, "bg-(--tg-red)/20")}>
        +{p.patto} +{p.inganno}
      </span>
      <span className={clsx(cell, "bg-(--tg-cream)/[0.06]")}>ipotesi giusta +{p.ipotesi}</span>
    </div>
  );
}

function Half({ side, text, big = false }: { side: "inizio" | "fine"; text: string; big?: boolean }) {
  return (
    <p className={clsx("font-extrabold leading-snug", big ? "text-2xl" : "text-lg")}>
      {side === "fine" && <span className="text-(--tg-cream)/35">… </span>}
      {text}
      {side === "inizio" && <span className="text-(--tg-cream)/35"> …</span>}
    </p>
  );
}

function MoveBadge({ move, tv = false, small = false }: { move: Mossa | null; tv?: boolean; small?: boolean }) {
  return (
    <span className={clsx("tg-display whitespace-nowrap rounded-md", tv ? (small ? "px-[0.4cqw] py-[0.1cqw] text-[1.05cqw]" : "px-[0.5cqw] text-[1.25cqw]") : "px-1.5 text-sm", move === "condividi" ? "bg-(--tg-gold) text-(--tg-ink)" : move === "inganna" ? "bg-(--tg-red) text-white" : "bg-(--tg-cream)/10 text-(--tg-cream)/60")}>
      {move === "condividi" ? "Condivide" : move === "inganna" ? "Inganna" : "Nessuna mossa"}
    </span>
  );
}

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const [move, setMove] = useState<Mossa | null>(null);
  const [guess, setGuess] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!move && !!guess;
  const submit = () => ready && p.canSubmit && send({ move: move!, guess: guess! });

  if (!mv) {
    return (
      <PlayerFrame view={view} p={p}>
        <Panel>
          <p className="font-bold">La vostra metà di frase sta arrivando…</p>
        </Panel>
      </PlayerFrame>
    );
  }
  const other = mv.partner ? `il tavolo ${mv.partner.tableNo}` : "il banco";
  const guessText = mv.candidates.find((o) => o.id === guess)?.text;

  if (p.stage === "reveal" && reveal) {
    const pair = reveal.summary?.pairs.find((x) => x.a === p.myTeam.teamId || x.b === p.myTeam.teamId);
    const mine = pair ? (pair.a === p.myTeam.teamId ? pair.moveA : pair.moveB) : null;
    const theirs = pair ? (pair.a === p.myTeam.teamId ? pair.moveB : pair.moveA) : null;
    const s = pair ? reveal.sentences[reveal.pairSentence[reveal.summary!.pairs.indexOf(pair)] ?? 0] : null;
    const solId = s ? mv.candidates.find((o) => o.text === (mv.side === "inizio" ? s.end : s.start))?.id : undefined;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-base font-bold">
            Voi <MoveBadge move={mine} /> · {other} <MoveBadge move={theirs} />
          </p>
          {s && (
            <p className="text-xl font-extrabold leading-snug">
              {s.start} {s.end}
            </p>
          )}
          {s && <p className="text-sm font-semibold text-(--tg-cream)/80">{s.why}</p>}
        </Panel>
        <ChoiceList options={mv.candidates} picked={sent && guess ? [guess] : []} onToggle={() => {}} keys={false} reveal={solId ? { solution: [solId] } : null} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Sigilla la mossa" hint={!move ? "Condividere o ingannare?" : !guess ? "Scegliete la vostra ipotesi" : undefined} />}
    >
      <Panel className="flex flex-col gap-2">
        <Eyebrow>
          {mv.topic} · voi vedete {mv.side === "inizio" ? "l'inizio" : "la fine"}, {other} {mv.side === "inizio" ? "la fine" : "l'inizio"}
        </Eyebrow>
        <Half side={mv.side} text={mv.mine} big />
      </Panel>
      <Panel tone="red" className="flex flex-col gap-3">
        <Eyebrow className="text-(--tg-red-hi)">1 · La vostra mossa con {other}</Eyebrow>
        <PactToggle
          label="Mossa"
          value={move}
          onChange={setMove}
          disabled={!editable}
          options={[
            { id: "condividi", title: "Condivido", sub: "Gli passate la vostra vera metà", tone: "gold", icon: "handshake" },
            { id: "inganna", title: "Inganno", sub: "Gli passate una metà falsa", tone: "red", icon: "sword" },
          ]}
        />
        <Matrix view={view} />
      </Panel>
      <Panel className="flex flex-col gap-2">
        <Eyebrow>2 · La vostra ipotesi (vale se {other} inganna)</Eyebrow>
        {guessText && (
          <p className="rounded-xl border-2 border-dashed border-(--tg-gold)/60 px-3 py-2 text-base font-bold leading-snug">
            {mv.side === "inizio" ? `${mv.mine} ${guessText}` : `${guessText} ${mv.mine}`}
          </p>
        )}
        <ChoiceList label="La metà mancante" options={mv.candidates} picked={guess ? [guess] : []} onToggle={(id) => editable && setGuess(id)} disabled={!editable} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  const res = new Map((done ? (reveal.summary?.pairs ?? []) : []).map((x) => [x.index, x]));
  const many = view.pairs.length > 3;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Chi ha condiviso, chi ha ingannato" : "A coppie: ognuno ha metà frase. Condividere o ingannare? Le regole sono uguali per tutti."}>
      <div className="grid h-full grid-cols-[1.3fr_1fr] gap-[1.4cqw]">
        <div className={clsx("grid min-h-0 content-start gap-[0.7cqw]", many ? "grid-cols-2" : "grid-cols-1")}>
          {view.pairs.map((pr) => {
            const r = res.get(pr.index);
            const s = done ? reveal.sentences[reveal.pairSentence[reveal.summary!.pairs.findIndex((x) => x.index === pr.index)] ?? 0] : null;
            return (
              <TvPanel key={pr.index} className={clsx("tg-rise flex min-h-0 flex-col", many ? "gap-[0.3cqw] p-[0.8cqw]" : "gap-[0.4cqw] p-[1.2cqw]")}>
                <p className={clsx("font-extrabold uppercase tracking-[0.14em] text-(--tg-cream)/65", many ? "text-[0.85cqw]" : "text-[1cqw]")}>{pr.topic}</p>
                {/* con 6 coppie (12 tavoli) bandiere e mosse più piccole: tutto su una riga, la frase resta intera */}
                <div className={clsx("flex flex-wrap items-center", many ? "gap-[0.4cqw]" : "gap-[0.5cqw]")}>
                  <TableTag tv small={many} no={pr.a.tableNo} color={team.get(pr.a.teamId)?.color} />
                  {r && <MoveBadge tv small={many} move={r.moveA} />}
                  <span className={clsx("tg-display text-(--tg-cream)/55", many ? "text-[1.15cqw]" : "text-[1.4cqw]")}>vs</span>
                  {pr.b ? <TableTag tv small={many} no={pr.b.tableNo} color={team.get(pr.b.teamId)?.color} /> : <span className={clsx("tg-display", many ? "text-[1.15cqw]" : "text-[1.4cqw]")}>Il banco</span>}
                  {r && <MoveBadge tv small={many} move={r.moveB} />}
                </div>
                {s && <p className={clsx("font-bold", many ? "text-[1.15cqw] leading-tight" : "text-[1.5cqw] leading-snug")}>{s.start} {s.end}</p>}
              </TvPanel>
            );
          })}
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex flex-col gap-[0.8cqw]">
            <p className="tg-display text-[2cqw]">Le regole, uguali per tutti</p>
            <Matrix view={view} tv />
            <p className="text-[1.1cqw] font-semibold leading-snug text-(--tg-cream)/70">Ognuno vede metà frase. Se l&apos;altro inganna, vale la vostra ipotesi sulla metà mancante. Il banco sceglie a caso e non prende punti.</p>
          </TvPanel>
          {done && <TvExplain text={reveal.explain} className="py-[0.9cqw]" />}
        </div>
      </div>
    </TvFrame>
  );
}

export const laFraseAMetaUi = defineUi(Player, Tv);

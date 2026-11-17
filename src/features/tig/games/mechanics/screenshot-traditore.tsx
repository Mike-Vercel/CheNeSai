"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { ScreenshotReveal, ScreenshotSubmission, ScreenshotView } from "@/lib/tig/games/mechanics/screenshot-traditore";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { ChatShot } from "../kit/chat";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, useSubmit } from "../kit/ui";

type P = PlayerGameProps<ScreenshotView, null, ScreenshotSubmission, ScreenshotReveal>;
type T = TvGameProps<ScreenshotView, ScreenshotReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <ChatShot chat={reveal.forwarded} mark={reveal.regionId} picked={sent && picked !== reveal.regionId ? picked : null} caption="Inoltrato (in rosso il dettaglio cambiato)" />
        <ChatShot chat={reveal.original} mark={reveal.regionId} caption="Originale" />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={
        <SubmitBar
          canSubmit={p.canSubmit}
          submitted={p.submitted}
          stage={p.stage}
          ready={!!picked}
          pending={pending}
          error={error}
          onSubmit={() => picked && send({ regionId: picked })}
          label="È questo il dettaglio"
          hint={picked ? undefined : "Toccate il fumetto (o l'intestazione) che è stato cambiato"}
        />
      }
    >
      <Panel className="py-3">
        <p className="text-base font-bold leading-snug">{view.context}</p>
      </Panel>
      <button
        type="button"
        onPointerDown={() => setShowOriginal(true)}
        onPointerUp={() => setShowOriginal(false)}
        onPointerLeave={() => setShowOriginal(false)}
        onClick={(e) => e.detail === 0 && setShowOriginal((v) => !v)}
        className={clsx("tg-display flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-xl select-none", showOriginal ? "border-[#6fe7ff] text-[#6fe7ff]" : "border-white/15 text-white/80")}
        aria-pressed={showOriginal}
      >
        <Icon name="eye" className="h-6 w-6" /> {showOriginal ? "Stai guardando l'originale" : "Tieni premuto: originale"}
      </button>
      {showOriginal ? (
        <ChatShot chat={view.original} caption="Originale" />
      ) : (
        <ChatShot chat={view.forwarded} caption="Inoltrato · toccate il dettaglio cambiato" onTap={editable ? setPicked : undefined} picked={picked} />
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const mark = p.stage === "reveal" && reveal ? reveal.regionId : null;
  return (
    <TvFrame view={view} p={p} subtitle={view.context}>
      <div className={clsx("mx-auto grid h-full max-w-[86cqw] gap-[2cqw]", mark ? "grid-cols-[1fr_1fr_0.9fr]" : "grid-cols-2")}>
        <div className="tg-rise min-h-0 overflow-hidden">
          <ChatShot chat={reveal?.original ?? view.original} size="tv" caption="Originale" mark={mark} />
        </div>
        <div className="tg-rise min-h-0 overflow-hidden" style={{ animationDelay: "120ms" }}>
          <ChatShot chat={reveal?.forwarded ?? view.forwarded} size="tv" caption="Inoltrato" mark={mark} />
        </div>
        {mark && reveal && <TvExplain text={reveal.explain} className="self-start" />}
      </div>
    </TvFrame>
  );
}

export const screenshotTraditoreUi = defineUi(Player, Tv);

"use client";

import { useCallback, useState } from "react";
import type { VisualQuality } from "@/features/tig/arena-contract";
import { JoinCard, JoinFlow } from "@/features/tig/join/JoinFlow";
import { PlayerScreen } from "@/features/tig/player/PlayerApp";
import { RegiaScreen } from "@/features/tig/regia/RegiaApp";
import { TigShell } from "@/features/tig/shell/TigShell";
import { TvShow } from "@/features/tig/tv/TvApp";
import { Logo } from "@/features/tig/ui";
import { TigArena } from "@/features/tig/visuals";
import { joinPreview, phoneScreen, regiaScreen, tvScreen } from "./fixtures";

/**
 * Banco di prova delle schermate dell'app (TV, telefono/PC, regia, ingresso, menu e wizard) con STATI FINTI:
 * stessi componenti dell'app vera, nessun database. Solo per guardare l'aspetto (gli invii non fanno nulla).
 */
export function SchermatePreview({ s, n, caption, quality, freeze, audio }: { s: string; n: number; caption: boolean; quality: VisualQuality; freeze: boolean; audio: boolean }) {
  const [t0] = useState(() => Date.now());
  const now = useCallback(() => (freeze ? t0 : Date.now()), [freeze, t0]);
  const act = useCallback(async () => ({ ok: true }), []);
  const actRegia = useCallback(async () => true, []);
  const keyFor = useCallback((k: string) => k, []);
  const noop = useCallback(() => {}, []);

  if (s === "menu" || s === "menu-riprendi")
    return <TigShell loggedIn username="anna" events={s === "menu-riprendi" ? [{ eventId: "e1", venue: "Taverna del Molo", state: "LEADERBOARD", role: "organizer", tables: 8, updatedAt: new Date(t0).toISOString() }] : []} start="menu" />;
  if (s === "wizard") return <TigShell loggedIn username="anna" events={[]} start="create" />;
  if (s === "j-codice") return <JoinFlow username="anna" />;
  if (s.startsWith("j-"))
    return (
      <div className="fixed inset-0 overflow-y-auto">
        <TigArena phase="lobby" teams={[]} mancheNo={null} title={null} spotlight={null} hosts={[]} now={now} quality="2d" className="!fixed" />
        <main className="relative mx-auto flex min-h-full w-full max-w-md flex-col items-center gap-6 px-4 pb-8 pt-14">
          <Logo size="md" />
          <JoinCard preview={joinPreview(s)} username="anna" token="anteprima" />
        </main>
      </div>
    );
  if (s.startsWith("p-")) {
    const { state, view } = phoneScreen(s, t0, n);
    return <PlayerScreen state={state} view={view} now={now} act={act} keyFor={keyFor} status="live" toast={null} clearToast={noop} />;
  }
  if (s.startsWith("r-")) {
    const { state, view } = regiaScreen(s, t0, n);
    return <RegiaScreen state={state} view={view} now={now} act={actRegia} busy={false} eventId="anteprima" status="live" toast={null} clearToast={noop} />;
  }
  const { state, lobby, live } = tvScreen(s, t0, n);
  const speech = caption
    ? { who: null, characterId: null, name: "Zafira", caption: "Benvenuti nella taverna! Stasera ogni tavolo è una ciurma: preparate i telefoni.", audible: false }
    : { who: null, characterId: null, name: null, caption: null, audible: false };
  return <TvShow state={state} lobby={lobby} live={live} now={now} quality={quality} speech={speech} unlocked={!audio} />;
}

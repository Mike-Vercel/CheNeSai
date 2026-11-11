"use client";

import { Component, Suspense, type ReactNode } from "react";
import type { Presenter } from "@/lib/game-engine/types";
import type { CharacterModelProps } from "./types";
import { CHARACTER_MODELS_PROCEDURAL } from "./registry";
import { HostGlbModel, hostGlbEnabled, reportHostGlbFailure, type HostGlbProps } from "./glb-host";

/** Se il GLB non si carica (404, file corrotto…) mostra `fallback` e lo segnala per il resto della sessione. */
export class GlbBoundary extends Component<{ who: Presenter; fallback: ReactNode; children: ReactNode; onFail?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn(`[che-ne-sai] GLB di ${this.props.who} non disponibile, uso il modello procedurale`, error);
    reportHostGlbFailure(this.props.who);
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type AutoProps = CharacterModelProps & Pick<HostGlbProps, "fullBody" | "walkRef" | "walkRate" | "walkRateRef" | "talkVariant">;

/**
 * Il personaggio "giusto": GLB riggato se attivo (default), altrimenti — o se il file non si
 * carica — il modello procedurale. Stesse props di tutti i modelli (CharacterModelProps).
 */
function HostAuto({ who, ...props }: AutoProps & { who: Presenter }) {
  const { fullBody, walkRef, walkRate, walkRateRef, talkVariant, ...base } = props;
  const Proc = CHARACTER_MODELS_PROCEDURAL[who];
  const procedural = <Proc {...base} />;
  if (!hostGlbEnabled(who)) return procedural;
  return (
    <GlbBoundary who={who} fallback={procedural}>
      <Suspense fallback={null}>
        <HostGlbModel who={who} {...base} fullBody={fullBody} walkRef={walkRef} walkRate={walkRate} walkRateRef={walkRateRef} talkVariant={talkVariant} />
      </Suspense>
    </GlbBoundary>
  );
}

export const ProfessoreAuto = (p: AutoProps) => <HostAuto who="professore" {...p} />;
export const ReginaAuto = (p: AutoProps) => <HostAuto who="regina" {...p} />;
export const PalminoAuto = (p: AutoProps) => <HostAuto who="palmino" {...p} />;

"use client";

import { clsx } from "clsx";
import { createContext, useContext, useId, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Presenter, PublicShowLine } from "@/lib/game-engine/types";
import { Character } from "@/features/game/components/brand";
import { useHeldSpeech, useSpeaker } from "@/features/media/voice";
import { bleedStyle, CharacterStage, type CastMember, type StageBleed } from "@/features/three/characters/CharacterStage";
import { useCharacterMode } from "@/features/three/characters/character-mode";
import type { CharacterAnimation } from "@/features/three/characters/types";
import { trioCast, type TrioMember, type TrioRole } from "./presenter-cue";

/**
 * I tre presentatori SEMPRE insieme sulle schermate del TV: davanti chi parla (o il padrone di
 * casa della schermata), dietro gli altri due che ascoltano e reagiscono.
 *
 * In 3D c'è UN solo canvas WebGL per tutta la serata (`TrioHost`, dentro TvStage): ogni schermata
 * mette un `TrioSlot` dove vuole i personaggi e il canvas viene spostato dentro quel riquadro.
 * Spostare un canvas nel DOM non perde il contesto WebGL: niente più modelli ricaricati e shader
 * ricompilati a ogni cambio schermata (era un fermo immagine di ~150 ms). Senza TrioHost (anteprime)
 * il riquadro si crea il suo canvas. In 2D le tre illustrazioni si dispongono allo stesso modo.
 */

/** Larghezza / altezza del riquadro del trio. */
export const TRIO_ASPECT = 1.3;
/** Spazio di disegno oltre il riquadro (braccia alzate e gesti non tagliati), simmetrico ai lati. */
const TRIO_BLEED: StageBleed = { left: 0.08, right: 0.08, top: 0.2 };
/** Inquadratura del trio (unità dei modelli: busto dei presentatori dalla vita in su, alto 1.8). */
const TRIO_FRAMING = { camera: [0, 1.05, 4.3] as [number, number, number], target: [0, 0.98, 0] as [number, number, number], fov: 30 };

const PLACE: Record<TrioRole, { x: number; z: number; rotationY: number; scale: number }> = {
  front: { x: 0, z: 0.45, rotationY: 0, scale: 1 },
  left: { x: -0.95, z: -0.5, rotationY: 0.32, scale: 0.88 },
  right: { x: 0.95, z: -0.5, rotationY: -0.32, scale: 0.88 },
};
/** Palmino ha l'origine ai piedi ed è alto 1.6: più grande e più in basso, i piedi escono dal riquadro. */
const PALMINO = { dy: -0.8, scale: 1.3 };

/** Cosa chiede la schermata: padrone di casa, sua animazione, battute del regista. */
export interface TrioRequest {
  host: Presenter;
  animation: CharacterAnimation;
  lines?: readonly PublicShowLine[] | null;
}

function useTrioMembers(req: TrioRequest): TrioMember[] {
  const speech = useHeldSpeech();
  return useMemo(() => trioCast(req.host, req.animation, req.lines, speech).members, [req.host, req.animation, req.lines, speech]);
}

/**
 * Frame al secondo del trio: pieni mentre qualcuno parla (labbra a tempo con la voce), 30 nel
 * resto del tempo (riposo e reazioni restano fluidi, la GPU disegna i tre personaggi la metà delle
 * volte); sempre 30 con "Prestazioni ridotte".
 */
function useTrioFpsCap(lowPower: boolean): number {
  const speaking = useSpeaker() !== null;
  return lowPower || !speaking ? 30 : 0;
}

function castFor(members: TrioMember[], gestureKey: string): CastMember[] {
  return members.map((m) => {
    const p = PLACE[m.role];
    const palm = m.who === "palmino";
    return {
      who: m.who,
      animation: m.animation,
      gestureKey,
      glide: true,
      position: [p.x, palm ? PALMINO.dy * p.scale : 0, p.z],
      rotationY: p.rotationY,
      scale: p.scale * (palm ? PALMINO.scale : 1),
    };
  });
}

// ------------------------------------------------------------------------- canvas unico
interface Registration {
  id: string;
  el: HTMLElement;
  req: TrioRequest;
}
interface TrioApi {
  set: (r: Registration) => void;
  clear: (id: string) => void;
}
const TrioCtx = createContext<TrioApi | null>(null);

const noop = () => () => {};
/** true solo nel browser, dopo l'idratazione (niente canvas nel render del server). */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** Ospita il canvas unico del trio per tutte le schermate che ci sono dentro. */
export function TrioHost({ children }: { children: ReactNode }) {
  const { mode } = useCharacterMode();
  const [reg, setReg] = useState<Registration | null>(null);
  const api = useMemo<TrioApi>(() => ({ set: (r) => setReg(r), clear: (id) => setReg((cur) => (cur?.id === id ? null : cur)) }), []);
  const client = useIsClient();
  const on = mode === "3d" && client;
  return (
    <TrioCtx.Provider value={on ? api : null}>
      {children}
      {on && <PersistentTrio reg={reg} />}
    </TrioCtx.Provider>
  );
}

const IDLE_REQ: TrioRequest = { host: "professore", animation: "idle" };

function PersistentTrio({ reg }: { reg: Registration | null }) {
  const { lowPower, fallback } = useCharacterMode();
  // contenitore staccato dal DOM di React: lo si appende al riquadro della schermata di turno
  const box = useMemo(() => {
    const d = document.createElement("div");
    Object.assign(d.style, bleedStyle(TRIO_BLEED));
    d.style.pointerEvents = "none";
    return d;
  }, []);
  // l'ultima richiesta resta valida mentre il trio è fuori scena (nessun cambio inutile nel canvas)
  const [last, setLast] = useState<{ req: TrioRequest; id: string }>({ req: IDLE_REQ, id: "" });
  if (reg && (reg.req !== last.req || reg.id !== last.id)) setLast({ req: reg.req, id: reg.id });
  const el = reg?.el ?? null;
  useLayoutEffect(() => {
    if (el) el.appendChild(box);
    else box.remove();
  }, [el, box]);
  useLayoutEffect(() => () => box.remove(), [box]);
  const members = useTrioMembers(last.req);
  const fpsCap = useTrioFpsCap(lowPower);
  return createPortal(
    <CharacterStage
      cast={castFor(members, last.id)}
      fpsCap={fpsCap}
      framing={TRIO_FRAMING}
      bleedTop={TRIO_BLEED.top}
      lowPower={lowPower}
      onFallback={fallback}
      frameloop={el ? "always" : "never"}
    />,
    box,
  );
}

// ------------------------------------------------------------------------- riquadro
/**
 * Dove la schermata vuole i tre presentatori (riquadro largo TRIO_ASPECT volte l'altezza).
 * `host` è il padrone di casa (davanti quando nessuno parla), `animation` il suo gesto.
 */
export function TrioSlot({
  host,
  animation = "idle",
  lines,
  className,
  children,
}: {
  host: Presenter;
  animation?: CharacterAnimation;
  lines?: readonly PublicShowLine[] | null;
  className?: string;
  children?: ReactNode;
}) {
  const ctx = useContext(TrioCtx);
  const { mode, lowPower, fallback } = useCharacterMode();
  const id = useId();
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const req = useMemo<TrioRequest>(() => ({ host, animation, lines }), [host, animation, lines]);
  useLayoutEffect(() => {
    if (ctx && el) ctx.set({ id, el, req });
  }, [ctx, id, el, req]);
  useLayoutEffect(() => () => ctx?.clear(id), [ctx, id]);
  return (
    <div ref={setEl} className={clsx("relative", className)} style={{ aspectRatio: TRIO_ASPECT }}>
      {mode === "3d" ? !ctx && <LocalTrio req={req} gestureKey={id} lowPower={lowPower} onFallback={fallback} /> : <Trio2D req={req} />}
      {children}
    </div>
  );
}

/** Anteprime senza TrioHost: canvas proprio dentro il riquadro. */
function LocalTrio({ req, gestureKey, lowPower, onFallback }: { req: TrioRequest; gestureKey: string; lowPower: boolean; onFallback: (reason?: string) => void }) {
  const members = useTrioMembers(req);
  const fpsCap = useTrioFpsCap(lowPower);
  return (
    <CharacterStage cast={castFor(members, gestureKey)} fpsCap={fpsCap} framing={TRIO_FRAMING} bleedTop={TRIO_BLEED.top} lowPower={lowPower} onFallback={onFallback} style={bleedStyle(TRIO_BLEED)} />
  );
}

// ------------------------------------------------------------------------- 2D
const PLACE_2D: Record<TrioRole, React.CSSProperties> = {
  front: { left: "24%", width: "52%", zIndex: 3 },
  left: { left: "0%", width: "40%", zIndex: 2, bottom: "5%", filter: "brightness(.8)" },
  right: { left: "60%", width: "40%", zIndex: 1, bottom: "5%", filter: "brightness(.8)" },
};

/** Illustrazioni originali: chi parla davanti e più grande, gli altri dietro un po' in ombra. */
function Trio2D({ req }: { req: TrioRequest }) {
  const members = useTrioMembers(req);
  const speaker = useSpeaker();
  return (
    <>
      {members.map((m) => (
        <div key={m.who} className="absolute bottom-0 transition-all duration-500 ease-out" style={PLACE_2D[m.role]}>
          <Character who={m.who} small={m.role !== "front"} className={clsx("w-full", speaker === m.who && "qz-talking")} />
        </div>
      ))}
    </>
  );
}

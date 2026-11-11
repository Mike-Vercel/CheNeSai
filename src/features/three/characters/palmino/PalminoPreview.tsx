"use client";

import dynamic from "next/dynamic";
import { useState, type CSSProperties } from "react";
import type { CharacterAnimation } from "../types";
import type { PreviewView } from "./PalminoPreviewCanvas";

const PalminoPreviewCanvas = dynamic(() => import("./PalminoPreviewCanvas"), {
  ssr: false,
  loading: () => <div style={{ color: "#c9b6e8", padding: 24 }}>Carico Palmino…</div>,
});

const ANIMS: { id: CharacterAnimation; label: string }[] = [
  { id: "idle", label: "Idle" },
  { id: "intro", label: "Intro" },
  { id: "talk", label: "Parla" },
  { id: "wave", label: "Saluta" },
  { id: "celebrate", label: "Esulta" },
  { id: "surprised", label: "Sorpreso" },
  { id: "point", label: "Indica" },
  { id: "spin", label: "Gira la ruota" },
];

const VIEWS: { id: PreviewView; label: string }[] = [
  { id: "ref", label: "Come il riferimento" },
  { id: "front", label: "Fronte" },
  { id: "34", label: "3/4" },
  { id: "side", label: "Lato sx" },
  { id: "sideR", label: "Lato dx" },
  { id: "back", label: "Retro" },
  { id: "close", label: "Viso" },
];

export interface PalminoPreviewProps {
  initialAnimation?: CharacterAnimation;
  initialView?: PreviewView;
  initialMouth?: number;
  initialSpeech?: boolean;
  lowPower?: boolean;
  showUi?: boolean;
  background?: string;
}

const btn = (active: boolean): CSSProperties => ({
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #6d4b98",
  background: active ? "#f3e60f" : "#2a1240",
  color: active ? "#1b0b2a" : "#efe6ff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
});

export function PalminoPreview(props: PalminoPreviewProps) {
  const [animation, setAnimation] = useState<CharacterAnimation>(props.initialAnimation ?? "idle");
  const [view, setView] = useState<PreviewView>(props.initialView ?? "front");
  const [mouth, setMouth] = useState(props.initialMouth ?? 0);
  const [speech, setSpeech] = useState(props.initialSpeech ?? false);
  const [noLipSync, setNoLipSync] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [lowPower, setLowPower] = useState(props.lowPower ?? false);
  const [stats, setStats] = useState<{ calls: number; triangles: number; fps: number; model?: { triangles: number; drawCalls: number } } | null>(null);
  const showUi = props.showUi ?? true;

  const play = (id: CharacterAnimation) => {
    if (id === animation && (id === "intro" || id === "surprised" || id === "spin")) {
      // ripeti la clip one-shot
      setAnimation("idle");
      window.setTimeout(() => setAnimation(id), 60);
      return;
    }
    setAnimation(id);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: props.background ?? "#170824", fontFamily: "system-ui, sans-serif" }}>
      <PalminoPreviewCanvas
        animation={animation}
        mouthOpen={mouth}
        simulateSpeech={speech}
        noLipSync={noLipSync}
        speed={speed}
        lowPower={lowPower}
        view={view}
        background={props.background}
        onStats={setStats}
      />
      {showUi && (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            padding: 12,
            borderRadius: 16,
            background: "rgba(23,8,36,0.82)",
            border: "1px solid #4a2c6b",
            color: "#efe6ff",
          }}
        >
          <strong style={{ marginRight: 8 }}>Palmino</strong>
          {ANIMS.map((a) => (
            <button key={a.id} type="button" data-anim={a.id} style={btn(animation === a.id)} onClick={() => play(a.id)}>
              {a.label}
            </button>
          ))}
          <span style={{ width: 12 }} />
          {VIEWS.map((v) => (
            <button key={v.id} type="button" data-view={v.id} style={btn(view === v.id)} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
            bocca
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={mouth}
              disabled={speech}
              onChange={(e) => setMouth(Number(e.target.value))}
              aria-label="mouthOpen"
            />
            <span style={{ width: 34, textAlign: "right" }}>{mouth.toFixed(2)}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={speech} onChange={(e) => setSpeech(e.target.checked)} data-speech />
            simula parlato
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }} title="Senza lip-sync la clip 'Parla' muove la bocca da sola">
            <input type="checkbox" checked={noLipSync} onChange={(e) => setNoLipSync(e.target.checked)} />
            senza lip-sync
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            velocità
            <input type="range" min={0.25} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="speed" />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={lowPower} onChange={(e) => setLowPower(e.target.checked)} />
            low power
          </label>
          {stats && (
            <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 13 }} data-stats>
              {stats.model ? `Palmino: ${stats.model.triangles.toLocaleString("it-IT")} triangoli, ${stats.model.drawCalls} draw call · ` : ""}
              {stats.fps} fps · scena {stats.calls} draw call / {stats.triangles.toLocaleString("it-IT")} tri
            </span>
          )}
        </div>
      )}
    </div>
  );
}

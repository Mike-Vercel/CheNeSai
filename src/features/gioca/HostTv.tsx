"use client";

import { clsx } from "clsx";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import type { PublicState } from "@/lib/game-engine/types";
import { HostControls } from "./HostControls";

const DisplayApp = dynamic(() => import("@/features/display/DisplayApp").then((m) => m.DisplayApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Collegamento allo studio…" />,
});

/**
 * Il PC dell'host diventa il TV: lo schermo del quiz con, sopra, i comandi minimi.
 * In lobby e sul podio i comandi restano visibili; durante la partita compaiono muovendo il mouse.
 */
export function HostTv({ sessionId, displayKey, canCreateMore }: { sessionId: string; displayKey: string; canCreateMore: boolean }) {
  return <DisplayApp sessionId={sessionId} displayKey={displayKey} renderOverlay={(s) => <HostTvOverlay sessionId={sessionId} state={s} canCreateMore={canCreateMore} />} />;
}

function HostTvOverlay({ sessionId, state, canCreateMore }: { sessionId: string; state: PublicState | null; canCreateMore: boolean }) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const wake = () => {
      setActive(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), 3500);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  if (!state) return null;
  const pinned = state.phase === "LOBBY" || state.phase === "READY" || state.phase === "FINISHED" || state.phase === "PAUSED";
  return (
    <div
      className={clsx(
        "absolute bottom-[2cqh] left-[1.5cqw] z-[66] max-w-[46cqw] rounded-[28px] bg-night/80 p-4 transition-opacity duration-300",
        pinned || active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <HostControls sessionId={sessionId} state={state} canCreateMore={canCreateMore} size="tv" />
    </div>
  );
}

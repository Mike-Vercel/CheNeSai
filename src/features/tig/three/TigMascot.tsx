"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { MascotProps } from "../arena-contract";
import Mascot2D from "./mascot/Mascot2D";

/**
 * TigMascot (contratto `MascotProps`): mascotte singola. 3D in un canvas trasparente caricato a richiesta; "2d" →
 * segnaposto SVG. Limite ai canvas 3D contemporanei (i browser reggono pochi contesti WebGL per pagina): oltre
 * MAX_CANVASES (es. il voto della mascotte con 12 schede) le altre restano in 2D, con lo stesso aspetto, e passano
 * al 3D appena si libera un posto.
 */
const Mascot3D = dynamic<MascotProps & { onFail?: () => void }>(() => import("./mascot/Mascot3D"), { ssr: false, loading: () => null });

export const MAX_CANVASES = 6;
const holders = new Set<symbol>();
const waiting = new Set<() => void>();

export function TigMascot(props: MascotProps) {
  const [has3d, setHas3d] = useState(false);
  const [failed, setFailed] = useState(false);
  const want3d = props.quality !== "2d" && !failed;
  useEffect(() => {
    if (!want3d) return;
    const me = Symbol("mascotte");
    const tryAcquire = () => {
      if (holders.has(me) || holders.size >= MAX_CANVASES) return;
      holders.add(me);
      waiting.delete(tryAcquire);
      setHas3d(true);
    };
    waiting.add(tryAcquire);
    const t = setTimeout(tryAcquire, 0);
    return () => {
      clearTimeout(t);
      waiting.delete(tryAcquire);
      if (holders.delete(me)) {
        setHas3d(false);
        for (const w of [...waiting]) w();
      }
    };
  }, [want3d]);
  if (!want3d || !has3d) return <Mascot2D {...props} />;
  return <Mascot3D {...props} onFail={() => setFailed(true)} />;
}

export default TigMascot;

"use client";

import { lazy, Suspense, useState } from "react";
import type { GiramenteWheelProps } from "./types";
import Wheel2D from "./Wheel2D";
import type { WheelCenter } from "./Wheel3D";

/** Il 3D (three.js) si scarica solo se serve: con qualità "2d" resta fuori dal bundle. */
const Wheel3D = lazy(() => import("./Wheel3D"));

export interface GiramenteWheelFullProps extends GiramenteWheelProps {
  /** Facoltativo (anteprime / scelta dell'utente): centro con il cervello 3D (predefinito) o con il logo G!. */
  center?: WheelCenter;
}

/**
 * LA RUOTA di GIRAMENTE! — 3D (qualità "high" / "low") oppure SVG ("2d" o se il 3D si rompe), con lo
 * stesso giro deterministico e lo stesso risultato. Mentre il 3D si scarica mostra già la versione 2D,
 * così chi entra a giro avviato vede subito la ruota al punto giusto.
 * Il contenitore decide le dimensioni (className): la ruota lo riempie.
 */
export default function GiramenteWheel(props: GiramenteWheelFullProps) {
  const [failed, setFailed] = useState(false);
  const use2d = props.quality === "2d" || failed;
  const center = props.center ?? "brain";
  if (use2d) return <Wheel2D {...props} center={center} />;
  return (
    <Suspense fallback={<Wheel2D {...props} center={center} />}>
      <Wheel3D
        {...props}
        center={center}
        onFail={(r) => {
          console.warn(`[giramente] ruota 3D → 2D: ${r}`);
          setFailed(true);
        }}
      />
    </Suspense>
  );
}

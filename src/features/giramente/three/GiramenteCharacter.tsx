"use client";

import { lazy, Suspense, useState } from "react";
import { Portrait2D } from "./Portrait2D";
import type { GiramenteCharacterProps } from "./types";

const CharacterStage3D = lazy(() => import("./CharacterStage3D"));

/**
 * DonTrallà o Zafira: personaggio 3D riggato (qualità "high"/"low") oppure ritratto 2D dichiarato
 * (qualità "2d", WebGL assente, file non caricato → onFail). Il contenitore decide le dimensioni.
 */
export default function GiramenteCharacter(props: GiramenteCharacterProps) {
  const [failed, setFailed] = useState(false);
  if (props.quality === "2d" || failed) return <Portrait2D who={props.who} speaking={props.speaking} mouthRef={props.mouthRef} className={props.className} />;
  return (
    <Suspense fallback={null}>
      <CharacterStage3D
        {...props}
        onFail={(r) => {
          console.warn(`[giramente] ${props.who} 3D → 2D: ${r}`);
          setFailed(true);
          props.onFail?.(r);
        }}
      />
    </Suspense>
  );
}

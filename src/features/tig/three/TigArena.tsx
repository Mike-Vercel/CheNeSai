"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ArenaProps } from "../arena-contract";
import Arena2D from "./arena/Arena2D";
import type { Arena3DProps } from "./arena/Arena3D";
import { preloadTigArena } from "./preload";

/**
 * TigArena (contratto `ArenaProps`): l'arena 3D caricata a richiesta (three.js e i modelli non entrano nel bundle
 * delle pagine finché non servono). Qualità "2d" → arena SVG/CSS. Mentre il 3D si scarica resta visibile l'arena 2D
 * con gli stessi dati, poi dissolvenza. Se il 3D si rompe (contesto WebGL perso, errore) si torna al 2D: il gioco
 * continua. Durante la lobby si scaricano in anticipo i modelli dei presentatori.
 */
const Arena3D = dynamic<Arena3DProps>(() => import("./arena/Arena3D"), { ssr: false, loading: () => null });

export function TigArena(props: ArenaProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const q = props.quality;
  const hostKey = props.hosts.map((h) => h.who).join(",");

  // in sala d'attesa: modulo 3D e modelli in anticipo, con calma
  useEffect(() => {
    if (q === "2d" || props.phase !== "lobby") return;
    const t = setTimeout(() => preloadTigArena(q, hostKey ? (hostKey.split(",") as ArenaProps["hosts"][number]["who"][]) : []), 600);
    return () => clearTimeout(t);
  }, [q, props.phase, hostKey]);

  if (q === "2d" || failed) return <Arena2D {...props} />;
  return (
    // senza className riempie il contenitore come l'arena 2D (altrimenti la tela resterebbe alta 150 px)
    <div className={props.className} style={props.className ? undefined : { position: "relative", width: "100%", height: "100%" }}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <div style={{ position: "absolute", inset: 0, opacity: ready ? 0 : 1, transition: "opacity 600ms ease", pointerEvents: "none" }} aria-hidden={ready}>
          {!ready && <Arena2D {...props} className="" onReady={undefined} />}
        </div>
        <Arena3D
          {...props}
          quality={q}
          className=""
          onReady={() => {
            setReady(true);
            props.onReady?.();
          }}
          onFail={(r) => {
            console.warn(`[tig] arena 3D non disponibile, si passa al 2D: ${r}`);
            setFailed(r);
          }}
        />
      </div>
    </div>
  );
}

export default TigArena;

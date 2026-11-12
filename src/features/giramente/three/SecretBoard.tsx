"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { boardColumnsFor, layoutBoard } from "./board-layout";
import type { BoardCell, SecretBoardProps } from "./types";
import "./secret-board.css";

/** classi di secret-board.css (CSS globale con prefisso: il progetto non usa i CSS Modules) */
const styles = { back: "gr3-tab-back", board: "gr3-tab-board", card: "gr3-tab-card", category: "gr3-tab-category", face: "gr3-tab-face", fresh: "gr3-tab-fresh", front: "gr3-tab-front", head: "gr3-tab-head", kicker: "gr3-tab-kicker", lite: "gr3-tab-lite", open: "gr3-tab-open", panel: "gr3-tab-panel", punct: "gr3-tab-punct", row: "gr3-tab-row", rows: "gr3-tab-rows", solved: "gr3-tab-solved", space: "gr3-tab-space", srOnly: "gr3-tab-sr-only", tile: "gr3-tab-tile" };

/**
 * IL TABELLONE SEGRETO di GIRAMENTE! — disegno originale: pannello grafite con filo verde in alto e rosso in basso,
 * caselle in rilievo (CSS 3D) che si girano mostrando la lettera con una lama di luce, accensione progressiva
 * all'apertura, parole separate e mandate a capo intere, punteggiatura sempre scoperta, categoria sopra.
 * Mostra SOLO ciò che riceve: le caselle coperte hanno char null (la soluzione non arriva mai qui).
 * Le righe ricevute vengono ri-impaginate sulla larghezza reale (telefono, PC, TV).
 */

const GAP_RATIO = 0.1;
const MAX_TILE = 86;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

function describe(rows: BoardCell[][]): string {
  return rows
    .map((r) => r.map((c) => (c.kind === "space" ? " / " : c.kind === "punct" ? c.char : (c.char ?? "_"))).join(" "))
    .join(" / ");
}

export default function SecretBoard({ category, rows, solved = false, quality, className }: SecretBoardProps) {
  const { ref, w } = useWidth();
  const maxCols = boardColumnsFor(w || 800);
  const lines = useMemo(() => layoutBoard(rows, maxCols), [rows, maxCols]);
  const cols = Math.max(1, ...lines.map((l) => l.reduce((acc, c) => acc + (c.kind === "letter" ? 1 : 0.62), 0)));
  // w è già la larghezza interna del pannello (senza padding)
  const inner = Math.max(0, w - 2);
  const tile = Math.max(18, Math.min(MAX_TILE, inner / (cols + (cols - 1) * GAP_RATIO)));
  const rowStart = lines.map((_, r) => lines.slice(0, r).reduce((acc, l) => acc + l.length, 0));
  return (
    <section className={`${styles.board} ${solved ? styles.solved : ""} ${quality !== "high" ? styles.lite : ""} ${className ?? ""}`} aria-label={`Il Tabellone Segreto. Categoria: ${category}`}>
      <header className={styles.head}>
        <span className={styles.kicker}>IL TABELLONE SEGRETO</span>
        <span className={styles.category}>{category}</span>
      </header>
      <div ref={ref} className={styles.panel} style={{ "--tile": `${tile}px`, "--gap": `${tile * GAP_RATIO}px` } as CSSProperties}>
        <span className={styles.srOnly}>{solved ? "Frase risolta: " : "Frase: "}{describe(lines)}</span>
        <div className={styles.rows} aria-hidden>
          {w > 0 &&
            lines.map((line, r) => (
              <div key={r} className={styles.row}>
                {line.map((cell, c) => {
                  const order = rowStart[r] + c;
                  const delay = { "--d": `${Math.min(order * 28, 1400)}ms` } as CSSProperties;
                  if (cell.kind === "space") return <span key={c} className={styles.space} />;
                  if (cell.kind === "punct")
                    return (
                      <span key={c} className={styles.punct} style={delay}>
                        {cell.char}
                      </span>
                    );
                  const open = cell.char !== null;
                  return (
                    <span key={c} className={`${styles.tile} ${open ? styles.open : ""} ${cell.justRevealed ? styles.fresh : ""}`} style={delay}>
                      <span className={styles.card}>
                        <span className={`${styles.face} ${styles.front}`} />
                        <span className={`${styles.face} ${styles.back}`}>{cell.char ?? ""}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

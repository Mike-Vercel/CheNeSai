import { describe, expect, it } from "vitest";
import { boardColumnsFor, boardWords, layoutBoard, letterBase, maskPhrase } from "@/features/giramente/three/board-layout";
import type { BoardCell } from "@/features/giramente/three/types";

/** Riga → testo leggibile: "_" coperta, "·" spazio. */
const text = (row: BoardCell[]) => row.map((c) => (c.kind === "space" ? "·" : c.kind === "punct" ? c.char : (c.char ?? "_"))).join("");

describe("Tabellone Segreto: caselle dalla frase", () => {
  it("accenti, apostrofi e punteggiatura: lettere coperte, punteggiatura sempre visibile", () => {
    const [row] = maskPhrase("Un'altra città, perché no?", []);
    expect(text(row)).toBe("__'_____·_____,·______·__?");
    const [row2] = maskPhrase("Un'altra città, perché no?", ["a", "E"]);
    expect(text(row2)).toBe("__'A___A·____À,·_E___É·__?");
  });

  it("apostrofo tipografico normalizzato e spazi multipli ridotti", () => {
    const [row] = maskPhrase("  L’ALBERO   VERDE ", ["l"]);
    expect(text(row)).toBe("L'_L____·_____");
  });

  it("le lettere appena svelate sono marcate", () => {
    const [row] = maskPhrase("CASA", ["C", "A"], ["A"]);
    expect(row.filter((c) => c.kind === "letter" && c.justRevealed).length).toBe(2);
  });

  it("letterBase toglie l'accento", () => {
    expect(letterBase("è")).toBe("E");
    expect(letterBase("À")).toBe("A");
    expect(letterBase("ù")).toBe("U");
  });
});

describe("Tabellone Segreto: a capo", () => {
  it("parole mai spezzate, spazio tra parole, righe entro il limite", () => {
    const rows = layoutBoard(maskPhrase("Chi dorme non piglia pesci", []), 10);
    expect(rows.map(text)).toEqual(["___·_____", "___·______", "_____"]);
    for (const r of rows) expect(r.length).toBeLessThanOrEqual(10);
  });

  it("bilanciamento: stesso numero di righe, larghezze simili", () => {
    const rows = layoutBoard(maskPhrase("L'appetito vien mangiando", []), 16);
    expect(rows.length).toBe(2);
    // la riga più larga si accorcia da 15 a 14 caselle senza aggiungere righe
    expect(rows.map(text)).toEqual(["_'________", "____·_________"]);
  });

  it("apostrofo dentro la parola: «dell'anno» resta su una riga", () => {
    const rows = layoutBoard(maskPhrase("La notte dell'anno", []), 9);
    expect(rows.map(text)).toEqual(["__·_____", "____'____"]);
  });

  it("parola più lunga di una riga: spezzata a pezzi", () => {
    const rows = layoutBoard(maskPhrase("Precipitevolissimevolmente", []), 10);
    expect(rows.map((r) => r.length)).toEqual([10, 10, 6]);
  });

  it("le righe in ingresso contano come separatori di parola", () => {
    const input: BoardCell[][] = [maskPhrase("UNO", [])[0], maskPhrase("DUE TRE", [])[0]];
    expect(boardWords(input).length).toBe(3);
    expect(layoutBoard(input, 16).map(text)).toEqual(["___·___·___"]);
  });

  it("frase vuota → nessuna riga; colonne per larghezza", () => {
    expect(layoutBoard([[]], 12)).toEqual([]);
    expect(boardColumnsFor(390)).toBe(10);
    expect(boardColumnsFor(1920)).toBe(16);
  });
});

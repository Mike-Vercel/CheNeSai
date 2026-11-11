import type { ShowEventType } from "./types";

/**
 * Anteprima di una battuta con valori di prova (pannello "Presentatori"):
 * il nome scelto dalla regia per il concorrente principale, "Gigi" per l'altro.
 */
export function previewText(event: ShowEventType, text: string, name: string): string {
  const other = name.toLowerCase() === "gigi" ? "Lalla" : "Gigi";
  const values: Record<string, string> = {
    nome: name,
    nome_primo: name,
    nome_sorpasso: name,
    nome_ultimo: name,
    nome_ex_primo: other,
    nome_superato: other,
    nomi_primi: `${name} e ${other}`,
    punti_primo: event === "ROUND_WINNER" ? "18500" : "12500",
    domande: "3",
    posizioni: "4",
    secondi: "2,4",
    serie: event === "WRONG_STREAK" ? "3" : "5",
    soglia: "10000",
    nome_squadra: "I Fenicotteri",
    nome_ex_squadra: "Gli Squali",
    punti_squadra: "15400",
  };
  return text.replace(/\{([a-z_]+)\}/g, (m, k: string) => values[k] ?? m);
}

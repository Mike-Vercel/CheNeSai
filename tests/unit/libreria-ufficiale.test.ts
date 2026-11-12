import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateTemplate } from "@/lib/show/director";
import { lineFitsMoment } from "@/features/game/moment";
import { displayOf } from "@/lib/show/library";
import { SHOW_EVENT_TYPES, type ShowEventType } from "@/lib/show/types";
import { DIALECT } from "../../scripts/palmino-italiano.mjs";

/**
 * La libreria ufficiale deve contenere TUTTE le battute dell'utente, PAROLA PER PAROLA
 * (content/battute/LIBRERIA-UFFICIALE.md → content/show/libreria-ufficiale.json).
 */
const md = readFileSync(join(process.cwd(), "content", "battute", "LIBRERIA-UFFICIALE.md"), "utf8").replace(/\r\n/g, "\n");
const lib = JSON.parse(readFileSync(join(process.cwd(), "content", "show", "libreria-ufficiale.json"), "utf8")) as {
  origin: string;
  lines: { id: string; character: string; event: ShowEventType; text: string; textF?: string; textN?: string; level: string; tags: string[]; scene?: { key: string; step: number }; animation: string | null }[];
};

/** Tutte le battute tra virgolette del testo (numerate o "Personaggio: …"), escluse le regole. */
function quotedLines(): string[] {
  const body = md.split("## 6. REGOLE FINALI")[0] + md.split("# NUOVE BATTUTE")[1].split("## REGOLE TECNICHE")[0];
  const out: string[] = [];
  for (const l of body.split("\n")) {
    const m = /^\s*(?:\d+\. |(?:Professore|Regina|Palmino): )"(.+)"\s*$/.exec(l);
    if (m) out.push(m[1]);
  }
  return out;
}

describe("libreria ufficiale: testo dell'utente parola per parola", () => {
  it("ogni battuta del testo è nella libreria, identica (e nessuna in più)", () => {
    const quoted = quotedLines();
    expect(quoted.length).toBe(330);
    expect(lib.lines.length).toBe(quoted.length);
    const texts = lib.lines.map((l) => l.text);
    for (const q of quoted) expect(texts).toContain(q);
    expect([...texts].sort()).toEqual([...quoted].sort());
    expect(lib.origin).toBe("ufficiale");
  });

  it("ogni battuta è valida per il suo evento (segnaposto ammessi) e ha un livello", () => {
    for (const l of lib.lines) {
      expect(SHOW_EVENT_TYPES).toContain(l.event);
      expect(validateTemplate(l)).toEqual([]);
      expect(["leggero", "sarcastico", "irriverente"]).toContain(l.level);
      expect(l.id).toMatch(/^[a-z0-9-]{3,80}$/);
    }
  });

  it("Palmino parla italiano (niente siciliano); la Regina 'cattivissima' è irriverente", () => {
    for (const l of lib.lines.filter((x) => x.character === "palmino")) {
      for (const t of [l.text, l.textF, l.textN]) if (t) expect(DIALECT.test(t), `${l.id}: ${t}`).toBe(false);
    }
    // anche le battute delle altre librerie che citano o fanno parlare Palmino
    const base = JSON.parse(readFileSync(join(process.cwd(), "content", "show", "battute.json"), "utf8")) as { lines: { text: string; textF?: string; textN?: string }[] };
    for (const l of base.lines) for (const t of [l.text, l.textF, l.textN]) if (t) expect(DIALECT.test(t), t).toBe(false);
    expect(lib.lines.find((l) => l.id === "uff-regina-cattivissima-50")?.level).toBe("irriverente");
    // le battute "per tutti" esistono per ogni evento principale
    for (const e of ["ANSWER_WRONG", "ANSWER_CORRECT", "TIME_RUNNING_OUT", "PLAYER_NO_ANSWER", "GAME_WINNER"] as const) {
      expect(lib.lines.some((l) => l.event === e && l.level === "leggero")).toBe(true);
    }
  });

  it("il vincitore della serata ha un evento a sé (solo podio); i segnaposto dei nomi sono quelli dell'utente", () => {
    const winner = lib.lines.filter((l) => l.text.includes("{nome_vincitore}"));
    expect(winner.length).toBe(7);
    expect(winner.every((l) => l.event === "GAME_WINNER")).toBe(true);
    expect(lib.lines.filter((l) => l.event === "GAME_WINNER").every((l) => l.text.includes("{nome_vincitore}"))).toBe(true);
    expect(lib.lines.filter((l) => l.text.includes("{nome_giocatore}")).every((l) => /NO_ANSWER/.test(l.event))).toBe(true);
  });

  it("scenette: 16 battibecchi + 4 speciali, righe in ordine, voci dei personaggi giusti", () => {
    const scenes = new Map<string, typeof lib.lines>();
    for (const l of lib.lines) if (l.scene) scenes.set(l.scene.key, [...(scenes.get(l.scene.key) ?? []), l]);
    expect(scenes.size).toBe(20);
    const neuroni = scenes.get("uff-scenetta-04")!;
    expect(neuroni.map((l) => [l.scene!.step, l.character])).toEqual([
      [1, "professore"],
      [2, "palmino"],
      [3, "professore"],
    ]);
    // una scenetta ha un solo evento e un solo livello
    for (const rows of scenes.values()) {
      expect(new Set(rows.map((r) => r.event)).size).toBe(1);
      expect(new Set(rows.map((r) => r.level)).size).toBe(1);
    }
    expect(scenes.get("uff-scenetta-16")![0].event).toBe("GAME_END");
    expect(scenes.get("uff-silenzio-03")![0].event).toBe("TEAM_NO_ANSWER");
  });

  it("sull'ultima domanda nessuna battuta sulla 'prossima domanda' (Prof 21 e 54, Regina 25, scenetta 13, speciale 4)", () => {
    const last = { lastOfRound: true, lastOfGame: true };
    const banned = ["uff-professore-facilissima-21", "uff-professore-pazienza-54", "uff-regina-indovina-25", "uff-scenetta-13-4", "uff-silenzio-04-3"];
    for (const id of banned) {
      const l = lib.lines.find((x) => x.id === id)!;
      expect(lineFitsMoment(displayOf(l.text), last), id).toBe(false);
    }
    // "la prossima volta" non è una domanda: resta
    expect(lineFitsMoment(lib.lines.find((x) => x.id === "uff-professore-silenzio-12")!.text, last)).toBe(true);
  });

  it("niente 'venerdì'; la battuta sui trenta secondi vale solo con il timer da 30", () => {
    expect(lib.lines.some((l) => /venerd/i.test(l.text))).toBe(false);
    const thirty = lib.lines.filter((l) => /trenta secondi/i.test(l.text));
    expect(thirty.length).toBeGreaterThan(0);
    expect(thirty.every((l) => l.tags.includes("timer30"))).toBe(true);
  });

  it("varianti per genere: femminile e neutra, valide e con gli stessi nomi del testo ufficiale", () => {
    const base = JSON.parse(readFileSync(join(process.cwd(), "content", "show", "battute.json"), "utf8")) as { lines: typeof lib.lines };
    const all = [...lib.lines, ...base.lines].filter((l) => l.textF || l.textN);
    expect(all.length).toBe(29);
    const ph = (t: string) => [...t.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).sort();
    for (const l of all) {
      for (const v of [l.textF, l.textN]) {
        expect(v, l.id).toBeTruthy();
        expect(validateTemplate({ event: l.event, text: v! })).toEqual([]);
        expect(ph(v!)).toEqual(ph(l.text));
        expect(v).not.toBe(l.text);
      }
      // rivolte a un giocatore nominato
      expect(ph(l.text).length).toBeGreaterThan(0);
    }
  });
});

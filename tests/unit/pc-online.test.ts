import { describe, expect, it } from "vitest";
import { answerKeyAction, digitOf, isTypingTarget } from "@/features/shared/keyboard";
import { decideShowLayout } from "@/features/shared/device";
import { liveViewPath } from "@/features/shared/live-window";
import { inviteMessage } from "@/features/gioca/invite";
import { streamAudioFromParam, streamSafeState } from "@/lib/game-engine/stream-view";
import type { PublicState } from "@/lib/game-engine/types";

/** Elemento finto (l'ambiente dei test è node): solo quello che leggono le funzioni della tastiera. */
function el(tagName: string, opts: { type?: string; editable?: boolean; inside?: string[] } = {}) {
  return {
    tagName,
    type: opts.type,
    isContentEditable: !!opts.editable,
    closest: (sel: string) => (opts.inside ?? []).some((s) => sel.includes(s)) || sel.split(",").some((s) => s.trim().toUpperCase() === tagName) ? {} : null,
  } as unknown as EventTarget;
}

const key = (k: string, code: string, extra: Partial<KeyboardEvent> = {}, target: EventTarget | null = el("DIV")) =>
  ({ key: k, code, ctrlKey: false, altKey: false, metaKey: false, repeat: false, defaultPrevented: false, target, ...extra }) as KeyboardEvent;

describe("tastiera: scorciatoie per giocare dal PC", () => {
  it("cifre della riga in alto e del tastierino numerico", () => {
    expect(digitOf({ key: "1", code: "Digit1" })).toBe(1);
    expect(digitOf({ key: "End", code: "Numpad1" })).toBe(1);
    expect(digitOf({ key: "4", code: "Digit4" })).toBe(4);
    expect(digitOf({ key: "&", code: "Digit1" })).toBe(1); // tastiere AZERTY: conta il tasto fisico
    expect(digitOf({ key: "0", code: "Digit0" })).toBeNull();
    expect(digitOf({ key: "a", code: "KeyA" })).toBeNull();
  });

  it("1–4 scelgono la risposta, solo fino al numero di opzioni", () => {
    expect(answerKeyAction(key("1", "Digit1"), 4, false)).toEqual({ pick: 0 });
    expect(answerKeyAction(key("4", "Digit4"), 4, false)).toEqual({ pick: 3 });
    expect(answerKeyAction(key("5", "Digit5"), 4, false)).toBeNull();
    expect(answerKeyAction(key("3", "Digit3"), 3, false)).toEqual({ pick: 2 });
    expect(answerKeyAction(key("4", "Digit4"), 3, false)).toBeNull();
  });

  it("Invio conferma solo dove serve, e mai sopra un pulsante (sarebbe un doppio clic)", () => {
    expect(answerKeyAction(key("Enter", "Enter"), 4, true)).toEqual({ confirm: true });
    expect(answerKeyAction(key("Enter", "Enter"), 4, false)).toBeNull();
    expect(answerKeyAction(key("Enter", "Enter", {}, el("BUTTON", { inside: ["button"] })), 4, true)).toBeNull();
  });

  it("mai mentre si scrive, dentro un dialogo, con Ctrl/Alt/Cmd o col tasto tenuto premuto", () => {
    expect(isTypingTarget(el("INPUT", { type: "text" }))).toBe(true);
    expect(isTypingTarget(el("INPUT", { type: "checkbox" }))).toBe(false);
    expect(isTypingTarget(el("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(el("SELECT"))).toBe(true);
    expect(isTypingTarget(el("DIV", { editable: true }))).toBe(true);
    expect(isTypingTarget(el("BUTTON", { inside: ["[role='dialog']"] }))).toBe(true);
    expect(answerKeyAction(key("1", "Digit1", {}, el("INPUT", { type: "text" })), 4, false)).toBeNull();
    expect(answerKeyAction(key("1", "Digit1", { ctrlKey: true }), 4, false)).toBeNull();
    expect(answerKeyAction(key("1", "Digit1", { metaKey: true }), 4, false)).toBeNull();
    expect(answerKeyAction(key("1", "Digit1", { altKey: true }), 4, false)).toBeNull();
    expect(answerKeyAction(key("1", "Digit1", { repeat: true }), 4, false)).toBeNull();
    expect(answerKeyAction(key("1", "Digit1", { defaultPrevented: true }), 4, false)).toBeNull();
    // fuoco su una risposta (Tab): il numero sceglie comunque
    expect(answerKeyAction(key("2", "Digit2", {}, el("BUTTON", { inside: ["button"] })), 4, false)).toEqual({ pick: 1 });
  });
});

describe("show orizzontale o verticale", () => {
  it("PC e tablet in orizzontale: show del TV; telefono e finestre strette: verticale", () => {
    expect(decideShowLayout(1440, 900)).toBe("landscape");
    expect(decideShowLayout(1280, 720)).toBe("landscape");
    expect(decideShowLayout(1920, 1080)).toBe("landscape");
    expect(decideShowLayout(1180, 820)).toBe("landscape"); // iPad in orizzontale
    expect(decideShowLayout(390, 844)).toBe("portrait");
    expect(decideShowLayout(844, 390)).toBe("portrait"); // telefono girato: troppo basso
    expect(decideShowLayout(820, 1180)).toBe("portrait"); // tablet in verticale
    expect(decideShowLayout(1000, 950)).toBe("portrait"); // finestra quasi quadrata
    expect(decideShowLayout(0, 0)).toBe("portrait");
  });
});

describe("vista per la LIVE", () => {
  const state = { code: "AB12CD", auto: { nextAt: "2026-01-01T00:00:00Z", version: 3 }, recentPlayers: ["Anna"], phase: "LOBBY" } as unknown as PublicState;

  it("niente codice né piano dello scorrimento; il resto dello show resta", () => {
    const s = streamSafeState(state);
    expect(s.code).toBe("");
    expect(s.auto).toBeNull();
    expect(s.recentPlayers).toEqual(["Anna"]);
    expect(JSON.stringify(s)).not.toContain("AB12CD");
    expect(state.code).toBe("AB12CD"); // l'originale non cambia
  });

  it("indirizzo senza codice; ?audio=0 per lo show muto", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    expect(liveViewPath(id)).toBe(`/gioca/live/${id}`);
    expect(liveViewPath(id, { audio: false })).toBe(`/gioca/live/${id}?audio=0`);
    expect(streamAudioFromParam(undefined)).toBe(true);
    expect(streamAudioFromParam("1")).toBe(true);
    expect(streamAudioFromParam("0")).toBe(false);
    expect(streamAudioFromParam(["off"])).toBe(false);
  });
});

describe("invito alla partita online", () => {
  it("dice di entrare con il proprio account, da qualunque dispositivo", () => {
    const m = inviteMessage({ code: "ab12cd", joinUrl: "https://x.it/play/AB12CD", host: "Mike", online: true });
    expect(m).toContain("Mike ti sfida");
    expect(m).toContain("PC, dal telefono o dal tablet");
    expect(m).toContain("account");
    expect(m).toContain("codice AB12CD");
    expect(m.split("\n").at(-1)).toBe("https://x.it/play/AB12CD");
    // in salotto resta il messaggio di sempre
    expect(inviteMessage({ code: "AB12CD", joinUrl: "u" })).toContain("basta un nickname");
  });
});

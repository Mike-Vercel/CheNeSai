"use client";

import { useEffect, useRef } from "react";

/**
 * Scorciatoie da tastiera per giocare dal PC (riutilizzabili da tutti i giochi):
 * 1–9 (anche dal tastierino numerico) scelgono l'opzione N, Invio conferma quando serve.
 *
 * Mai mentre si scrive: niente scorciatoie con il fuoco in un campo di testo, area di testo, menu a
 * tendina o elemento modificabile, né dentro una finestra di dialogo aperta (impostazioni), né con
 * Ctrl/Alt/Cmd premuti (le scorciatoie del browser restano libere). Il tasto tenuto premuto non ripete.
 * Invio sopra un pulsante o un link lascia fare al browser (clic su quel pulsante): niente doppioni.
 */

/** L'evento arriva mentre si sta scrivendo (o da un elemento che usa i tasti per sé)? */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).closest !== "function") return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    // caselle e pulsanti radio non sono "scrittura"; tutto il resto sì (testo, numeri, email, range…)
    return type !== "checkbox" && type !== "radio" && type !== "button" && type !== "submit";
  }
  return !!el.closest("[contenteditable=''],[contenteditable='true'],[role='dialog'],[role='textbox']");
}

/** Numero (1–9) del tasto premuto, o null. Cifre della riga in alto e del tastierino numerico. */
export function digitOf(e: Pick<KeyboardEvent, "key" | "code">): number | null {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code ?? "");
  if (m) return Number(m[1]);
  return /^[1-9]$/.test(e.key) ? Number(e.key) : null;
}

export interface AnswerKeysOptions {
  /** scorciatoie attive (es. risposte aperte e giocatore seduto) */
  enabled: boolean;
  /** quante opzioni ci sono: si accettano i tasti da 1 a `count` */
  count: number;
  /** tasto N premuto: indice 0-based dell'opzione */
  onPick: (index: number) => void;
  /** Invio: conferma (solo dove serve, es. risposta multipla) */
  onConfirm?: (() => void) | null;
}

/** Decide cosa fa un tasto (puro, per i test): opzione N, conferma o niente. */
export function answerKeyAction(
  e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "altKey" | "metaKey" | "repeat" | "defaultPrevented" | "target">,
  count: number,
  canConfirm: boolean,
): { pick: number } | { confirm: true } | null {
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return null;
  if (isTypingTarget(e.target)) return null;
  if (e.key === "Enter") {
    if (!canConfirm) return null;
    const el = e.target as HTMLElement | null;
    // Invio su un pulsante/link: è già un clic su quell'elemento
    if (el && typeof el.closest === "function" && el.closest("button,a,[role='button']")) return null;
    return { confirm: true };
  }
  const d = digitOf(e);
  if (d === null || d > count) return null;
  return { pick: d - 1 };
}

export function useAnswerKeys({ enabled, count, onPick, onConfirm = null }: AnswerKeysOptions): void {
  const pickRef = useRef(onPick);
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    pickRef.current = onPick;
    confirmRef.current = onConfirm;
  });
  const canConfirm = !!onConfirm;
  useEffect(() => {
    if (!enabled || count < 1) return;
    const onKey = (e: KeyboardEvent) => {
      const a = answerKeyAction(e, count, canConfirm);
      if (!a) return;
      e.preventDefault();
      if ("pick" in a) pickRef.current(a.pick);
      else confirmRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, count, canConfirm]);
}

"use client";

import { useSyncExternalStore } from "react";

/**
 * Suspense della soluzione: quando inizia ANSWER_REVEAL il TV tiene nascosta la risposta giusta
 * (domanda `heldFor`) finché il presentatore non ha finito "La risposta giusta è…"; poi la
 * evidenzia mentre dice la risposta. Senza voce (o se la frase non arriva) si scopre da sola.
 */
let heldFor: string | null = null;
const listeners = new Set<() => void>();

export function holdReveal(questionId: string | null) {
  if (heldFor === questionId) return;
  heldFor = questionId;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** true se la soluzione di questa domanda è ancora nascosta. */
export function useRevealHeld(questionId: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !!questionId && heldFor === questionId,
    () => false,
  );
}

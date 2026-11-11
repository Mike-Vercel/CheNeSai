"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/** Monta i figli solo nel browser (il provider dei personaggi legge WebGL/URL già al primo render). */
export function ClientOnly({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return mounted ? children : null;
}

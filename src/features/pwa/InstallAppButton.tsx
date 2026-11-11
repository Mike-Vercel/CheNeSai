"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "hidden" | "prompt" | "ios";

function initialMode(): Mode {
  if (typeof window === "undefined") return "hidden";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "hidden";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "hidden";
}

/**
 * "Installa l'app" discreto: su Android e Chrome/Edge desktop apre la richiesta di installazione
 * del browser (beforeinstallprompt); su iPhone/iPad spiega "Condividi → Aggiungi alla schermata Home".
 * Non compare se l'app è già installata o se il browser non lo consente.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMode(initialMode()), 0);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  async function onClick() {
    if (mode === "ios") {
      setHelp((h) => !h);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    setDeferred(null);
    if (outcome === "accepted") setMode("hidden");
  }

  return (
    <span className={clsx("relative inline-flex", className)}>
      <button type="button" onClick={() => void onClick()} aria-expanded={mode === "ios" ? help : undefined} className="qz-install inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm font-extrabold text-white/80 underline-offset-4 hover:text-white hover:underline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={20} height={20} className="h-5 w-5 rounded-md" />
        Installa l&apos;app
      </button>
      {help && (
        <span role="note" className="absolute bottom-full left-0 z-40 mb-2 w-64 rounded-2xl bg-night-3 p-3 text-sm font-bold text-white shadow-2xl">
          Tocca <strong>Condividi</strong> in Safari e poi <strong>&laquo;Aggiungi alla schermata Home&raquo;</strong>.
        </span>
      )}
    </span>
  );
}

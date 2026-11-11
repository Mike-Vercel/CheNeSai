"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "qz.installHint.dismissed";

/** Evento non standard di Chrome/Android per proporre l'installazione. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "other";

function detect(): { show: boolean; platform: Platform } {
  if (typeof window === "undefined") return { show: false, platform: "other" };
  try {
    if (localStorage.getItem(STORAGE_KEY)) return { show: false, platform: "other" };
  } catch {
    // localStorage bloccato (navigazione privata): si mostra comunque, la chiusura vale per la pagina
  }
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return { show: false, platform: "other" };
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  // solo su telefoni e tablet: sul PC della regia o sul TV non serve
  if (!ios && !android) return { show: false, platform: "other" };
  return { show: true, platform: ios ? "ios" : "android" };
}

/**
 * Suggerimento chiudibile "Aggiungi alla schermata Home" nella lobby del telefono.
 * Non compare se l'app è già installata; la chiusura viene ricordata nel telefono (localStorage).
 * Su Android, se il browser lo consente, il pulsante apre direttamente la richiesta di installazione.
 */
export function InstallHint() {
  const [{ show, platform }, setState] = useState(detect);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setState((s) => ({ ...s, show: false }));
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignorato: si chiude solo per questa pagina
    }
    setState((s) => ({ ...s, show: false }));
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    setDeferred(null);
    if (outcome === "accepted") dismiss();
  }

  return (
    <aside className="relative w-full rounded-2xl border border-gold/40 bg-night-2/90 p-3 pr-11 text-left shadow-[var(--shadow-panel)]" aria-label="Aggiungi alla schermata Home">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full text-xl font-bold text-white/60 hover:bg-white/10 hover:text-white"
        aria-label="Chiudi il suggerimento"
      >
        ×
      </button>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight text-gold">Aggiungi alla schermata Home</p>
          <p className="mt-0.5 text-sm font-bold text-white/80">
            {platform === "ios" ? (
              <>
                Tocca <span aria-hidden>⎙</span> <strong>Condividi</strong> e poi <strong>&laquo;Aggiungi alla schermata Home&raquo;</strong>: la prossima volta entri al volo.
              </>
            ) : deferred ? (
              "Installa l'app sul telefono: la prossima volta entri al volo, a schermo intero."
            ) : (
              <>
                Apri il menu del browser <span aria-hidden>⋮</span> e scegli <strong>&laquo;Aggiungi a schermata Home&raquo;</strong>.
              </>
            )}
          </p>
          {deferred && platform !== "ios" && (
            <button type="button" onClick={() => void install()} className="mt-2 rounded-xl bg-gold px-4 py-2 text-sm font-black text-ink">
              Installa
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

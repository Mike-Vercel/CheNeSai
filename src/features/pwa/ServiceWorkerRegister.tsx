"use client";

import { useEffect } from "react";

/**
 * Registra /sw.js solo nella build di produzione. In sviluppo rimuove un eventuale service worker
 * rimasto da una prova in produzione sullo stesso indirizzo, così `next dev` non serve file vecchi.
 * Gli aggiornamenti dell'app li gestisce già useAutoReload: qui non si ricarica mai la pagina.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => undefined);
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // senza service worker l'app funziona comunque (niente pagina offline)
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}

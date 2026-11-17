import type { HostId, VisualQuality } from "../arena-contract";

/**
 * Scarica in anticipo il modulo dell'arena 3D e i modelli dei presentatori (da chiamare in sala d'attesa).
 * Non blocca nulla: gli errori di rete si ignorano (il caricamento vero li gestirà).
 */
export function preloadTigArena(quality: VisualQuality, hosts: HostId[] = []): void {
  if (quality === "2d" || typeof window === "undefined") return;
  void (async () => {
    try {
      const [{ useGLTF }, models] = await Promise.all([import("@react-three/drei"), import("./characters/host-models"), import("./arena/Arena3D")]);
      for (const who of hosts) for (const url of models.hostModelFiles(who, quality)) useGLTF.preload(url);
    } catch {
      /* anticipo fallito: nessun problema */
    }
  })();
}

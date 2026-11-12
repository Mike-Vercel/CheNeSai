"use client";

import { useState, useSyncExternalStore } from "react";
import type { RoomMode } from "@/lib/psyco/types";
import { CreateForm } from "./CreateForm";
import { IntroPlayer, markCreateIntroSeen, shouldShowCreateIntro } from "./intro/PsycoIntro";
import { markWelcomed } from "./narrator";

const noop = () => () => {};

/**
 * «Nuova partita» di PSYCO, nell'ordine voluto:
 *   1. INTRO 3D subito (l'Investigatore entra, si siede, dà il benvenuto) — «SALTA INTRO» sempre visibile;
 *   2. le impostazioni della partita (come giocate, chi gioca, tempo, regole…);
 *   3. «AVVIA» → la stanza: QR e codice per invitare, oppure il dispositivo unico.
 * L'intro si vede una volta per scheda (si segna alla fine); la stanza appena creata non la ripete.
 */
export function NuovaFlow({ initialMode, username }: { initialMode: RoomMode; username: string | null }) {
  // null sul server e al primo disegno: schermo nero finché non si sa se parte l'intro
  const wanted = useSyncExternalStore(noop, shouldShowCreateIntro, () => null);
  const [done, setDone] = useState(false);

  if (wanted === null) return <div aria-hidden className="fixed inset-0 z-[70] bg-[#060505]" />;
  const intro = wanted && !done;
  return (
    <>
      {intro && (
        <IntroPlayer
          onDone={() => {
            markCreateIntroSeen();
            markWelcomed();
            setDone(true);
          }}
        />
      )}
      <div className={intro ? "hidden" : "psy-fade-in w-full"}>
        <CreateForm initialMode={initialMode} username={username} introPlayed={!intro} />
      </div>
    </>
  );
}

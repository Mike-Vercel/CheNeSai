import { z } from "zod";

/**
 * Preferenze del TV che il telefono (telecomando) può cambiare a distanza: audio e poco altro.
 * Sottoinsieme di TvPrefs (features/display/tv-prefs.ts); il TV le applica alla prossima
 * chiamata di presenza (ogni ~3 s).
 */
const level = z.number().min(0).max(1);
export const remotePrefsSchema = z
  .object({
    masterVolume: level,
    musicVolume: level,
    sfxVolume: level,
    muted: z.boolean(),
    voice: z.boolean(),
    readOptions: z.boolean(),
    theme: z.boolean(),
    rules: z.boolean(),
    characters3d: z.boolean(),
    lowPower: z.boolean(),
    reducedMotion: z.boolean(),
  })
  .partial()
  .strict();

export type RemotePrefs = z.infer<typeof remotePrefsSchema>;

/** Codice di abbinamento del TV: 4 cifre (facile da leggere sul televisore e da scrivere sul telefono). */
export const pairingCodeSchema = z.string().trim().regex(/^[0-9]{4}$/, "Il codice è di 4 cifre");

/**
 * L'INVESTIGATORE (voce narrante di PSYCO): quale file GLB usare. UNICO PUNTO da cambiare.
 *
 *  - "a" = public/models/investigatore.glb, da REFERENCE/GIOCHI/PSYCO/MODELLI-3D/INVESTIGATORE_PARLANTE.glb
 *          (bocca preparata dall'utente in Blender);
 *  - "b" = public/models/investigatore-b.glb, da INVESTIGATORE.glb (senza bocca) + la nostra bocca
 *          (src/features/three/tools/blender_add_mouth.py con mouth_investigatore.json), come Palmino e Regina.
 *
 * Si cambia qui (INVESTIGATORE_DEFAULT) oppure senza toccare il codice con NEXT_PUBLIC_QZ_INVESTIGATORE=a|b
 * (Vercel / .env.local, serve una nuova build). Confronto: /preview/investigatore?variant=a|b&speak=1.
 * La variante leggera (-low) si sceglie da sola sui dispositivi poco potenti.
 */
export type InvestigatoreVariant = "a" | "b";

const INVESTIGATORE_DEFAULT: InvestigatoreVariant = "a";

export const INVESTIGATORE_VARIANT: InvestigatoreVariant =
  process.env.NEXT_PUBLIC_QZ_INVESTIGATORE === "b" ? "b" : process.env.NEXT_PUBLIC_QZ_INVESTIGATORE === "a" ? "a" : INVESTIGATORE_DEFAULT;

export const INVESTIGATORE_FILES: Record<InvestigatoreVariant, string> = {
  a: "/models/investigatore.glb",
  b: "/models/investigatore-b.glb",
};

/** File della variante (la -low la aggiunge hostGlbUrl). */
export function investigatoreUrl(variant: InvestigatoreVariant = INVESTIGATORE_VARIANT): string {
  return INVESTIGATORE_FILES[variant];
}

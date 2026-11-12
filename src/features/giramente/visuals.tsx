/**
 * Componenti visivi di GIRAMENTE! (ruota, Don Patrizio, Zafira, portale della Jolly, tabellone segreto).
 *
 * Versioni 3D (./three): ruota sul supporto, personaggi GLB, portale. Ognuna sceglie da sola la qualità
 * (high / low / 2d con la stessa ruota in SVG) e il 3D si scarica solo quando serve (lazy).
 * Le versioni 2D di riserva restano in ./fallback (stesse props) per prove e confronti.
 * Il gioco passa sempre i propri spicchi (`segments`) nell'ordine del server: l'ordine non dipende da qui.
 */
export * from "./three";

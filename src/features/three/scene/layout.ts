import { Vector3 } from "three";

/**
 * Coordinate di regia (metri). Il palco è centrato in (0,0,0.4), il LED wall a z≈-9.4.
 * I presentatori (ritagli 2.5D) stanno DIETRO ai podi: il taglio a mezzo busto resta nascosto.
 */
export const LAYOUT = {
  stageTop: 0.35,
  podiumProf: new Vector3(-5.8, 0.35, 1.6),
  podiumRegina: new Vector3(5.8, 0.35, 1.6),
  /** Piede del piano immagine (nascosto dal podio alto 1.77). */
  profAnchor: new Vector3(-5.85, 0.95, 1.0),
  reginaAnchor: new Vector3(5.95, 0.95, 1.0),
  profHeight: 4.3,
  reginaHeight: 4.15,
  /** Palmino al centro del palco, davanti. */
  palminoHero: new Vector3(0, 0.35, 2.7),
  palminoHeroHeight: 3.0,
  /** Emblema: rivelazione davanti alla camera… */
  logoReveal: new Vector3(0, 4.55, 8.6),
  /** …e posizione di parcheggio al centro-fondo dello studio (davanti al LED wall). */
  logo: new Vector3(0, 8.7, -6.4),
  /** Altezza dell'emblema in metri. */
  logoHeight: 5.0,
} as const;

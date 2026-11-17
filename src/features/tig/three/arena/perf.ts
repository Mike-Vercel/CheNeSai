/**
 * PROFILO DI RESA dell'arena (puro, testato): dalla qualità del contratto ("high"/"low") e dalla scheda video
 * (integrata o dedicata) sceglie risoluzione interna, antialiasing, bagliore (bloom), riflesso del pavimento, fari e
 * particelle. A partita in corso il profilo può SCENDERE di un gradino se i fotogrammi restano lenti (e risalire
 * quando tornano veloci): fluidità prima di tutto, ma senza tornare a un aspetto povero.
 *
 * Gradini (dal più ricco):  4 ultra (GPU dedicata) · 3 studio (GPU integrata da PC, default qui) ·
 *                           2 leggero (qualità low, telefoni) · 1 essenziale · 0 minimo (emergenza).
 */

export type GpuClass = "dedicated" | "integrated" | "mobile" | "unknown";

/** Classe della scheda video dal nome del renderer WebGL (WEBGL_debug_renderer_info). */
export function classifyGpu(renderer: string | null | undefined): GpuClass {
  const r = (renderer ?? "").toLowerCase();
  if (!r) return "unknown";
  if (/adreno|mali|powervr|apple gpu|apple a\d|immortalis|xclipse|videocore|tegra/.test(r)) return "mobile";
  if (/nvidia|geforce|quadro|rtx|gtx|radeon(?!.*(vega \d|graphics))|rx \d|arc\(tm\) a\d|arc a\d/.test(r)) return "dedicated";
  if (/apple m\d/.test(r)) return "dedicated";
  if (/intel|uhd|iris|hd graphics|radeon.*graphics|vega \d|microsoft basic/.test(r)) return "integrated";
  return "unknown";
}

export interface RenderProfile {
  level: 0 | 1 | 2 | 3 | 4;
  /** tetto della densità di pixel (mai sopra devicePixelRatio) */
  maxDpr: number;
  /** tetto dei pixel disegnati (una TV 4K o un portatile ad alta densità non affogano la scheda) */
  maxPixels: number;
  /** campioni MSAA nel buffer di resa (0 = niente, si usa l'AA in post) */
  msaa: 0 | 2 | 4;
  /** antialiasing in post quando non c'è MSAA */
  postAA: "smaa" | "fxaa" | "none";
  /** bagliore: risoluzione relativa (0 = spento) */
  bloom: number;
  /** riflesso vero del pavimento: risoluzione relativa (0 = niente) e ogni quanti fotogrammi si aggiorna */
  reflect: number;
  reflectEvery: 1 | 2 | 3;
  /** fari sull'americana e particelle */
  fixtures: number;
  dust: number;
  confetti: number;
  /** vignettatura e grana del "broadcast" */
  vignette: boolean;
  /** tetto di fotogrammi a riposo (60 = sempre fluido) */
  idleFps: number;
}

// scendendo di gradino non sale MAI il numero di pixel (maxDpr e maxPixels non crescono): si tolgono prima gli
// effetti (riflesso, fari, particelle), poi l'antialiasing più caro, solo alla fine la risoluzione
const LEVELS: RenderProfile[] = [
  { level: 0, maxDpr: 0.75, maxPixels: 0.9e6, msaa: 0, postAA: "fxaa", bloom: 0, reflect: 0, reflectEvery: 3, fixtures: 6, dust: 60, confetti: 80, vignette: false, idleFps: 30 },
  { level: 1, maxDpr: 1, maxPixels: 1.6e6, msaa: 0, postAA: "fxaa", bloom: 0.25, reflect: 0, reflectEvery: 3, fixtures: 6, dust: 100, confetti: 110, vignette: true, idleFps: 45 },
  { level: 2, maxDpr: 1.5, maxPixels: 2.2e6, msaa: 0, postAA: "smaa", bloom: 0.33, reflect: 0, reflectEvery: 2, fixtures: 8, dust: 140, confetti: 140, vignette: true, idleFps: 60 },
  { level: 3, maxDpr: 1.5, maxPixels: 2.4e6, msaa: 0, postAA: "smaa", bloom: 0.5, reflect: 0.3, reflectEvery: 2, fixtures: 10, dust: 260, confetti: 220, vignette: true, idleFps: 60 },
  { level: 4, maxDpr: 1.75, maxPixels: 4.2e6, msaa: 4, postAA: "none", bloom: 0.5, reflect: 0.5, reflectEvery: 1, fixtures: 12, dust: 360, confetti: 280, vignette: true, idleFps: 60 },
];

export function profileAt(level: number): RenderProfile {
  return LEVELS[Math.max(0, Math.min(4, Math.round(level)))];
}

/** Densità di pixel di resa: tetto del gradino, del dispositivo e del numero di pixel (arrotondata al centesimo). */
export function renderDpr(profile: RenderProfile, deviceDpr: number, cssW: number, cssH: number): number {
  const area = Math.max(1, cssW * cssH);
  const byPixels = Math.sqrt(profile.maxPixels / area);
  const d = Math.min(profile.maxDpr, Math.max(0.5, deviceDpr || 1), byPixels);
  return Math.max(0.5, Math.round(d * 100) / 100);
}

/** Gradino di partenza: qualità del contratto + scheda video. */
export function initialLevel(quality: "high" | "low", gpu: GpuClass): RenderProfile["level"] {
  if (quality === "low") return gpu === "dedicated" ? 3 : 2;
  if (gpu === "dedicated") return 4;
  if (gpu === "mobile") return 2;
  return 3;
}

/**
 * Regolatore a gradini: misura il tempo medio dei fotogrammi disegnati quando la scena si muove a piena velocità.
 * Sotto ~50 fps per `downAfter` secondi scende di un gradino (mai sotto `floor`), sopra ~58 fps con margine per
 * `upAfter` secondi risale (mai sopra il gradino di partenza). Puro: niente three, niente DOM.
 */
export class PerfGovernor {
  level: RenderProfile["level"];
  private readonly ceiling: RenderProfile["level"];
  private readonly floor: RenderProfile["level"];
  private slowFor = 0;
  private fastFor = 0;
  private cooldown = 0;

  constructor(start: RenderProfile["level"], floor: RenderProfile["level"] = 1, readonly downAfter = 2.5, readonly upAfter = 8) {
    this.level = start;
    this.ceiling = start;
    this.floor = Math.min(start, floor) as RenderProfile["level"];
  }

  /**
   * `frameMs` = durata media dei fotogrammi disegnati, `dt` = secondi trascorsi dall'ultima misura,
   * `busy` = la scena corre a piena velocità (solo allora la misura è significativa). Restituisce true se il gradino cambia.
   */
  update(frameMs: number, dt: number, busy: boolean): boolean {
    if (!busy || !(frameMs > 0)) return false;
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return false;
    }
    if (frameMs > 1000 / 50) {
      this.slowFor += dt;
      this.fastFor = 0;
    } else if (frameMs < 1000 / 58.5) {
      this.fastFor += dt;
      this.slowFor = 0;
    } else {
      this.slowFor = 0;
      this.fastFor = 0;
    }
    if (this.slowFor >= this.downAfter && this.level > this.floor) {
      this.level = (this.level - 1) as RenderProfile["level"];
      this.slowFor = 0;
      this.cooldown = 3;
      return true;
    }
    if (this.fastFor >= this.upAfter && this.level < this.ceiling) {
      this.level = (this.level + 1) as RenderProfile["level"];
      this.fastFor = 0;
      this.cooldown = 4;
      return true;
    }
    return false;
  }
}

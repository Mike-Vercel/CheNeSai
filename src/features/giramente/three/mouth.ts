/**
 * Apertura della bocca 0..1 (puro, senza three): sillabe finte quando un personaggio parla senza audio,
 * e livello RMS della voce → bocca (stessa formula dei presentatori e dell'Investigatore).
 */
export function simulatedMouth(t: number): number {
  const p = t * 11.5;
  return 0.18 + 0.62 * Math.max(0, Math.sin(p) * Math.sin(p * 0.37 + 1.3));
}

/** RMS della voce (0..1) → apertura della bocca 0..1. */
export function levelToMouth(rms: number): number {
  return Math.min(1, Math.max(0, (rms - 0.015) * 7));
}

/**
 * Bocca dall'AnalyserNode di un elemento audio (lip-sync): da chiamare a ogni fotogramma.
 * Il chiamante crea l'analyser (es. AudioContext.createMediaElementSource → createAnalyser) e scrive il
 * risultato in un RefObject<number> passato come mouthRef ai personaggi.
 */
export function createAnalyserMouth(analyser: AnalyserNode) {
  const data = new Uint8Array(analyser.fftSize);
  return function read(): number {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return levelToMouth(Math.sqrt(sum / data.length));
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIP_WAIT_LIVE_MS, CLIP_WAIT_MS, clipWaitMs, waitForClip } from "@/features/media/voice-wait";

/** Attesa della clip ElevenLabs sul TV: lenta = si aspetta, guasto = voce del browser subito. */
describe("attesa della voce professionale", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("tetti di attesa lunghi (mai i vecchi 2,5 s)", () => {
    expect(clipWaitMs(true)).toBe(CLIP_WAIT_LIVE_MS);
    expect(clipWaitMs(false)).toBe(CLIP_WAIT_MS);
    expect(CLIP_WAIT_LIVE_MS).toBeGreaterThanOrEqual(10_000);
    expect(CLIP_WAIT_MS).toBeGreaterThanOrEqual(10_000);
  });

  it("clip lenta (8 s): si aspetta e si usa la clip", async () => {
    const slow = new Promise<string | null>((r) => setTimeout(() => r("https://clip/lenta.mp3"), 8000));
    const got = waitForClip(slow, clipWaitMs(true));
    await vi.advanceTimersByTimeAsync(2500);
    let settled = false;
    void got.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false); // a 2,5 s NON si passa alla voce del browser
    await vi.advanceTimersByTimeAsync(6000);
    await expect(got).resolves.toBe("https://clip/lenta.mp3");
  });

  it("guasto vero (errore, budget 503, voce spenta → nessun URL): subito null", async () => {
    await expect(waitForClip(Promise.resolve(null), clipWaitMs(true))).resolves.toBeNull();
    await expect(waitForClip(Promise.reject(new Error("rete")), clipWaitMs(true))).resolves.toBeNull();
  });

  it("oltre il tetto: null (voce del browser)", async () => {
    const never = new Promise<string | null>(() => undefined);
    const got = waitForClip(never, 12_000);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(got).resolves.toBeNull();
  });
});

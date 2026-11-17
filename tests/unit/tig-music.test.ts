import { describe, expect, it } from "vitest";
import { availableTrack, gameTrack, musicFor } from "@/features/tig/music";
import type { TigPublicState } from "@/lib/tig/types";

const st = (over: Partial<TigPublicState>) => ({ state: "LOBBY_OPEN", pausedFrom: null, game: null, manche: null, spotlight: null, ...over }) as unknown as TigPublicState;
const game = (code: string, extra: Record<string, unknown> = {}) => ({ id: "g1", code, kind: "regular", stage: "play", ...extra }) as unknown as TigPublicState["game"];

describe("TAVOLI IN GUERRA! · musica di sottofondo", () => {
  it("un brano per fase, con la catena di riserva", () => {
    expect(musicFor(st({ state: "LOBBY_OPEN" }))?.names).toEqual(["lobby", "sigla"]);
    expect(musicFor(st({ state: "ROUND_INTRO", manche: { no: 3 } as TigPublicState["manche"] }))?.names).toEqual(["manche-3"]);
    expect(musicFor(st({ state: "LEADERBOARD" }))?.loop).toBe(true);
    expect(musicFor(st({ state: "GAME_RESULTS" }))?.loop).toBe(false);
  });

  it("il minigioco usa il suo brano, poi quello generico; mai il generico dove un ritmo aiuterebbe a contare", () => {
    expect(gameTrack("memoria-lampo")).toBe("gioco-01-memoria-lampo");
    expect(musicFor(st({ state: "GAME_ACTIVE", game: game("memoria-lampo") }))?.names).toEqual(["gioco-01-memoria-lampo", "prova"]);
    expect(musicFor(st({ state: "GAME_ACTIVE", game: game("tempo-fantasma") }))?.names).toEqual(["gioco-04-tempo-fantasma"]);
    expect(musicFor(st({ state: "GAME_ACTIVE", game: game("x", { kind: "caos", stage: "rule" }) }))?.names).toEqual(["allarme-caos"]);
  });

  it("solo i brani presenti; in pausa resta la fase di prima", () => {
    const cue = musicFor(st({ state: "GAME_ACTIVE", game: game("memoria-lampo") }));
    expect(availableTrack(cue, [])).toBeNull();
    expect(availableTrack(cue, ["prova"])).toBe("prova");
    expect(availableTrack(cue, ["prova", "gioco-01-memoria-lampo"])).toBe("gioco-01-memoria-lampo");
    expect(musicFor(st({ state: "PAUSED", pausedFrom: "LEADERBOARD" }))?.names).toEqual(["classifica"]);
  });
});

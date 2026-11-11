import { describe, expect, it } from "vitest";
import {
  chooseScreen,
  describeScreens,
  isTvScreenMessage,
  loadScreenChoice,
  popupFeatures,
  saveScreenChoice,
  SCREEN_STORAGE_KEY,
  screenKey,
  tvChannelName,
  tvWindowName,
  type ScreenLike,
} from "@/features/display/screen-picker";

const laptop: ScreenLike = { left: 0, top: 0, width: 1920, height: 1080, availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1032, isPrimary: true, isInternal: true, label: "Schermo integrato", devicePixelRatio: 1 };
const tv: ScreenLike = { left: 1920, top: 0, width: 1920, height: 1080, availLeft: 1920, availTop: 0, availWidth: 1920, availHeight: 1080, isPrimary: false, isInternal: false, label: "", devicePixelRatio: 2 };

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("schermo TV: etichette", () => {
  it("ordina da sinistra a destra e descrive ruolo e risoluzione", () => {
    const list = describeScreens([tv, laptop]);
    expect(list.map((s) => s.label)).toEqual(["Schermo 1 – principale 1920×1080 (Schermo integrato)", "Schermo 2 – TV 3840×2160"]);
    expect(list[1]).toMatchObject({ index: 1, isPrimary: false, pixelWidth: 3840, availLeft: 1920 });
  });

  it("un solo schermo", () => {
    expect(describeScreens([{ ...laptop, label: "" }])[0].label).toBe("Schermo 1 – questo schermo 1920×1080");
  });

  it("schermo integrato non principale", () => {
    const list = describeScreens([{ ...laptop, isPrimary: false }, { ...tv, isPrimary: true, label: "LG TV" }]);
    expect(list[0].label).toContain("integrato");
    expect(list[1].label).toBe("Schermo 2 – principale 3840×2160 (LG TV)");
  });
});

describe("schermo TV: scelta", () => {
  const list = describeScreens([laptop, tv]);

  it("senza scelta salvata propone lo schermo che non è il principale (il TV)", () => {
    expect(chooseScreen(list, null)?.index).toBe(1);
  });

  it("usa la scelta salvata se lo schermo c'è ancora", () => {
    expect(chooseScreen(list, screenKey(laptop))?.index).toBe(0);
    expect(chooseScreen(list, "9999,0:1x1")?.index).toBe(1);
    expect(chooseScreen([], null)).toBeNull();
  });

  it("ricorda la scelta su questo dispositivo", () => {
    const st = memoryStorage();
    expect(loadScreenChoice(st)).toBeNull();
    saveScreenChoice(screenKey(tv), st);
    expect(st.m.get(SCREEN_STORAGE_KEY)).toBe("1920,0:1920x1080");
    expect(loadScreenChoice(st)).toBe("1920,0:1920x1080");
    st.setItem(SCREEN_STORAGE_KEY, "spazzatura");
    expect(loadScreenChoice(st)).toBeNull();
  });

  it("archiviazione non disponibile: nessun errore", () => {
    const broken = {
      getItem: () => {
        throw new Error("bloccato");
      },
      setItem: () => {
        throw new Error("bloccato");
      },
    };
    expect(loadScreenChoice(broken)).toBeNull();
    expect(() => saveScreenChoice("1,1:1x1", broken)).not.toThrow();
    expect(loadScreenChoice(null)).toBeNull();
  });
});

describe("schermo TV: finestra e messaggi", () => {
  it("posizione della finestra sullo schermo scelto", () => {
    const [, tvInfo] = describeScreens([laptop, tv]);
    expect(popupFeatures(tvInfo)).toBe("popup,left=1920,top=0,width=1920,height=1080");
    expect(popupFeatures(tvInfo, true)).toBe("popup,left=1920,top=0,width=1920,height=1080,fullscreen");
    expect(popupFeatures(null)).toBe("popup,width=1280,height=720");
  });

  it("nomi di canale e finestra per sessione", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(tvChannelName(id)).toBe(`qz-tv:${id}`);
    expect(tvWindowName(id)).toMatch(/^qz-tv-[a-z0-9]{32}$/);
  });

  it("riconosce solo i messaggi validi", () => {
    expect(isTvScreenMessage({ type: "move", key: "1,0:1x1" })).toBe(true);
    expect(isTvScreenMessage({ type: "move" })).toBe(false);
    expect(isTvScreenMessage({ type: "ping" })).toBe(true);
    expect(isTvScreenMessage({ type: "boom" })).toBe(false);
    expect(isTvScreenMessage(null)).toBe(false);
  });
});

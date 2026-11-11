import { describe, expect, it } from "vitest";
import { decideDevice, type DeviceSignals } from "@/features/gioca/device-mode";
import { inviteMessage, joinLink, whatsappUrl } from "@/features/gioca/invite";

const base: DeviceSignals = { coarse: false, hover: true, screenWidth: 1920, screenHeight: 1080 };

describe("telefono o computer? (dopo CREA PARTITA)", () => {
  it("PC col mouse: desktop (si va dritti al TV)", () => {
    expect(decideDevice(base)).toBe("desktop");
    expect(decideDevice({ ...base, uaMobile: false })).toBe("desktop");
  });

  it("telefono: handheld (anche senza Client Hints, es. Safari su iPhone)", () => {
    expect(decideDevice({ coarse: true, hover: false, screenWidth: 390, screenHeight: 844 })).toBe("handheld");
    expect(decideDevice({ ...base, uaMobile: true })).toBe("handheld");
    // in orizzontale non cambia nulla
    expect(decideDevice({ coarse: true, hover: false, screenWidth: 844, screenHeight: 390 })).toBe("handheld");
  });

  it("tablet: handheld (Chrome su tablet Android dice mobile=false ma il dito è il puntatore)", () => {
    expect(decideDevice({ uaMobile: false, coarse: true, hover: false, screenWidth: 800, screenHeight: 1280 })).toBe("handheld");
    expect(decideDevice({ coarse: true, hover: false, screenWidth: 1024, screenHeight: 1366 })).toBe("handheld");
  });

  it("portatile touch (mouse principale) e grandi schermi touch: desktop", () => {
    expect(decideDevice({ coarse: false, hover: true, screenWidth: 1366, screenHeight: 768 })).toBe("desktop");
    expect(decideDevice({ coarse: true, hover: false, screenWidth: 3840, screenHeight: 2160 })).toBe("desktop");
    expect(decideDevice({ coarse: true, hover: false, screenWidth: 0, screenHeight: 0 })).toBe("desktop");
  });
});

describe("invito alla partita", () => {
  it("link per entrare con il codice", () => {
    expect(joinLink("https://che-ne-sai.vercel.app/", "ab12cd")).toBe("https://che-ne-sai.vercel.app/play/AB12CD");
  });

  it("messaggio con chi invita, codice e link in fondo", () => {
    const m = inviteMessage({ code: "ab12cd", joinUrl: "https://x.it/play/AB12CD", host: "Mike" });
    expect(m).toContain("Mike ti sfida a CHE NE SAI?!");
    expect(m).toContain("codice AB12CD");
    expect(m.split("\n").at(-1)).toBe("https://x.it/play/AB12CD");
    expect(inviteMessage({ code: "AB12CD", joinUrl: "u", host: "  " })).toMatch(/^🎤 Ti sfido/);
  });

  it("WhatsApp: testo già scritto, codificato nel link wa.me", () => {
    const m = inviteMessage({ code: "AB12CD", joinUrl: "https://x.it/play/AB12CD?a=1&b=2" });
    const url = whatsappUrl(m);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url).not.toContain(" ");
    expect(url).not.toContain("&b=2");
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe(m);
  });
});

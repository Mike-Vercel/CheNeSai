import { describe, expect, it } from "vitest";
import { findNames, MIN_FIXED_CHARS, nameVariants, normalizeNames, normalizeNumber, PREWARM_NUMBERS, segmentPause, splitByNames, splitSentences } from "@/features/game/name-segments";
import { ttsText } from "@/features/game/script";

const texts = (segs: ReturnType<typeof splitByNames>) => segs?.map((s) => `${s.kind === "name" ? "N" : s.kind === "number" ? "#" : "F"}:${s.text}`);

describe("nomi salvati: divisione delle battute", () => {
  it("nessun nome né numero nel testo → frase intera (null)", () => {
    expect(splitByNames("[excited] Il colpo migliore è di Marco: più 30 punti!", ["Gigi", "Anna"], { numbers: false })).toBeNull();
    expect(splitByNames("Benvenuti a tutti!", [])).toBeNull();
  });

  it("divide parti fisse e nome, con la punteggiatura attaccata al nome", () => {
    expect(texts(splitByNames("[sarcastic] Gigi, il suo regno è durato meno di un gelato ad agosto. Ora comanda Anna.", ["Gigi", "Anna"]))).toEqual([
      "N:Gigi,",
      "F:[sarcastic] il suo regno è durato meno di un gelato ad agosto. Ora comanda",
      "N:Anna.",
    ]);
  });

  it("ricomponendo le parti si ottengono le stesse parole della frase (tag a parte)", () => {
    const line = "[clears throat] Ufficiale: Anna Maria è il nuovo capolista con 1200 punti. Sic transit gloria mundi, Bruno.";
    const segs = splitByNames(line, ["Anna Maria", "Bruno"])!;
    const words = (s: string) => s.replace(/\[[^\]]+\]/g, " ").split(/\s+/).filter(Boolean);
    expect(segs.flatMap((s) => words(s.text))).toEqual(words(line));
    // il numero è una parte a sé (archivio dei numeri), il testo attorno resta fisso e riusabile
    expect(texts(segs)).toEqual(["F:[clears throat] Ufficiale:", "N:Anna Maria", "F:è il nuovo capolista con", "#:1200", "F:punti. Sic transit gloria mundi,", "N:Bruno."]);
    // senza numeri: la frase con i punti è separata da quella riusabile
    expect(texts(splitByNames(line, ["Anna Maria", "Bruno"], { numbers: false }))).toEqual([
      "F:[clears throat] Ufficiale:",
      "N:Anna Maria",
      "F:è il nuovo capolista con 1200 punti.",
      "F:Sic transit gloria mundi,",
      "N:Bruno.",
    ]);
  });

  describe("numeri salvati", () => {
    it("punti, delta e totali: nome + fisso + numero + fisso", () => {
      expect(texts(splitByNames("[excited] In testa c'è Bruno, con 2440 punti! Applausi, prego.", ["Bruno"]))).toEqual([
        "F:[excited] In testa c'è",
        "N:Bruno,",
        "F:con",
        "#:2440",
        "F:punti! Applausi, prego.",
      ]);
      expect(texts(splitByNames("[excited] Il colpo migliore è di Marco: più 1488 punti!", []))).toEqual(["F:[excited] Il colpo migliore è di Marco: più", "#:1488", "F:punti!"]);
    });

    it("stesso valore → stessa parte (migliaia col punto, negativi, decimali con la virgola)", () => {
      const a = splitByNames("Che serata: Lalla vola a 1.250 punti, record!", ["Lalla"]);
      const b = splitByNames("Che serata: Lalla vola a 1250 punti, record!", ["Lalla"]);
      expect(a).toEqual(b);
      expect(normalizeNumber("1.250")).toBe("1250");
      expect(normalizeNumber("12.450.000")).toBe("12450000");
      expect(normalizeNumber("2,4")).toBe("2,4");
      expect(texts(splitByNames("Lalla scende a -400 punti, un record negativo della serata!", ["Lalla"]))).toEqual([
        "N:Lalla",
        "F:scende a",
        "#:-400",
        "F:punti, un record negativo della serata!",
      ]);
      expect(texts(splitByNames("Il primato di velocità spetta a Gigi: 2,4 secondi. Mi riservo di verificare.", ["Gigi"]))).toEqual([
        "F:Il primato di velocità spetta a",
        "N:Gigi:",
        "#:2,4",
        "F:secondi. Mi riservo di verificare.",
      ]);
    });

    it("punteggiatura attaccata al numero; numeri dentro i nomi o le parole restano dove sono", () => {
      expect(texts(splitByNames("[giggles] Salutamu a Gigi, Lalla e altri 3! Ora sì che la serata pigghia colore!", ["Gigi", "Lalla"]))).toEqual([
        "F:[giggles] Salutamu a",
        "N:Gigi, Lalla",
        "F:e altri",
        "#:3!",
        "F:Ora sì che la serata pigghia colore!",
      ]);
      expect(texts(splitByNames("Applausi per Gigi99, il campione della serata in MP3!", ["Gigi99"]))).toEqual(["F:Applausi per", "N:Gigi99,", "F:il campione della serata in MP3!"]);
    });

    it("numeri da preparare: 1–20", () => {
      expect(PREWARM_NUMBERS).toHaveLength(20);
      expect(PREWARM_NUMBERS[0]).toBe("1");
    });
  });

  it("nomi sovrapposti: vince il più lungo, il più corto solo dove è parola intera", () => {
    const segs = splitByNames("Anna Maria supera Anna e anche Annalisa, che resta indietro di parecchio!", ["Anna", "Anna Maria"]);
    // "Annalisa" non è "Anna"
    expect(texts(segs)).toEqual(["N:Anna Maria supera Anna", "F:e anche Annalisa, che resta indietro di parecchio!"]);
    expect(findNames("Gigio e Gigi", ["Gigi", "Gigio"]).length).toBe(2);
  });

  it("maiuscole e accenti: ricerca senza distinzione, testo come nella frase", () => {
    expect(texts(splitByNames("Che colpo di scena: NICOLÒ è il nuovo capolista della serata!", ["Nicolò"]))).toEqual([
      "F:Che colpo di scena:",
      "N:NICOLÒ",
      "F:è il nuovo capolista della serata!",
    ]);
    expect(texts(splitByNames("Applausi per zoë, la più veloce della serata!", ["Zoë"]))).toEqual(["F:Applausi per", "N:zoë,", "F:la più veloce della serata!"]);
  });

  it("nickname con punteggiatura ed emoji (ripuliti come nel copione)", () => {
    // cleanSpeech: [ ] → ( ), "?!" → "?"
    const nick = "Gigi [Boss]";
    expect(normalizeNames([nick])).toEqual(["Gigi (Boss)"]);
    expect(texts(splitByNames("Il primato di velocità spetta a Gigi (Boss): una saetta!", [nick]))).toEqual([
      "F:Il primato di velocità spetta a",
      "N:Gigi (Boss):",
      "F:una saetta!",
    ]);
    expect(texts(splitByNames("Applausi per 🔥Lalla🔥 che vola in testa alla classifica!", ["🔥Lalla🔥"]))).toEqual([
      "F:Applausi per",
      "N:🔥Lalla🔥",
      "F:che vola in testa alla classifica!",
    ]);
  });

  it("i nomi non si cercano dentro gli audio tag e i nomi di una lettera si ignorano", () => {
    expect(splitByNames("[laughs] Che serata incredibile, davvero!", ["laughs"])).toBeNull();
    expect(normalizeNames(["E", "x", "🔥"])).toEqual([]);
  });

  it("più nomi di fila (congiunzioni, parole brevi) formano una sola parte", () => {
    expect(texts(splitByNames("[laughs] Ecco la classifica! Primo Gigi, secondo Lalla, terzo Bruno. Gli altri… ci stanno lavorando!", ["Gigi", "Lalla", "Bruno"]))).toEqual([
      "F:[laughs] Ecco la classifica! Primo",
      "N:Gigi, secondo Lalla, terzo Bruno.",
      "F:Gli altri… ci stanno lavorando!",
    ]);
    expect(texts(splitByNames("Amori miei, Gigi e Bruno a pari merito! Ho una corona sola.", ["Gigi", "Bruno"]))).toEqual([
      "F:Amori miei,",
      "N:Gigi e Bruno",
      "F:a pari merito! Ho una corona sola.",
    ]);
  });

  it("audio tag: quelli iniziali sulla prima parte fissa, quello prima di un nome resta sul nome", () => {
    expect(texts(splitByNames("[giggles] Gigi contro il resto del mondo... e vince Gigi! Ih ih!", ["Gigi"]))).toEqual([
      "N:Gigi",
      "F:[giggles] contro il resto del mondo... e vince",
      "N:Gigi!",
      "F:Ih ih!",
    ]);
    expect(texts(splitByNames("Al terzo posto della classifica… [excited] Bruno!", ["Bruno"]))).toEqual(["F:Al terzo posto della classifica…", "N:[excited] Bruno!"]);
    expect(texts(splitByNames("[shouts] E il vincitore di stasera è… Anna! [giggles] Complimentoni!", ["Anna"]))).toEqual([
      "F:[shouts] E il vincitore di stasera è…",
      "N:Anna!",
      "F:[giggles] Complimentoni!",
    ]);
  });

  it("parole isolate: unite al nome se la frase continua, a sé se sono una frase completa", () => {
    expect(texts(splitByNames("Solo Gigi ha risposto correttamente. Unus contra omnes!", ["Gigi"]))).toEqual(["N:Solo Gigi", "F:ha risposto correttamente. Unus contra omnes!"]);
    expect(texts(splitByNames("Attenzione! Lalla supera Gigi! Una rimonta interessante!", ["Lalla", "Gigi"]))).toEqual([
      "F:Attenzione!",
      "N:Lalla supera Gigi!",
      "F:Una rimonta interessante!",
    ]);
  });

  it("troppo poco testo fisso riusabile → frase intera", () => {
    expect(splitByNames("Brava Anna!", ["Anna"])).toBeNull();
    expect(splitByNames("Gigi: più 1488 punti!", ["Gigi"])).toBeNull(); // il resto ha numeri: non riusabile
    expect(MIN_FIXED_CHARS).toBeGreaterThan(5);
  });

  it("le parti sono nella forma canonica della sintesi", () => {
    const segs = splitByNames("  Ora   comanda    Gigi,   il   re   della   serata!  ", ["Gigi"])!;
    for (const s of segs) expect(s.text).toBe(ttsText(s.text));
  });

  it("frasi: si divide solo davanti a una maiuscola o a un tag", () => {
    expect(splitSentences("5 risposte errate di fila. Errare humanum est, perseverare... è consentito.")).toEqual([
      "5 risposte errate di fila. ",
      "Errare humanum est, perseverare... è consentito.",
    ]);
    expect(splitSentences("2,4 secondi! [laughs] Che fulmine!")).toEqual(["2,4 secondi! ", "[laughs] Che fulmine!"]);
  });

  it("varianti del nome e pause", () => {
    expect(nameVariants("Gigi")).toEqual(["Gigi", "Gigi,", "Gigi!", "Gigi."]);
    expect(nameVariants("x")).toEqual([]);
    expect(segmentPause("Gigi,")).toBe("comma");
    expect(segmentPause("Anna!")).toBe("stop");
    expect(segmentPause("è di")).toBe("none");
  });
});

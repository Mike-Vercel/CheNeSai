"""
Controllo dei lotti di domande nuove (content/domande/nuove/*.json).

    python scripts/domande/controlla.py                 # tutti i lotti
    python scripts/domande/controlla.py storia-01.json  # solo alcuni file

Verifica formato, risposte, lunghezze, categorie e DOPPIONI (anche quasi uguali) contro
content/domande/verificate, content/domande/pilot e gli altri lotti. Esce con codice 1 se ci sono errori.
"""
import glob
import io
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NUOVE = os.path.join(ROOT, "content", "domande", "nuove")
ESISTENTI = [os.path.join(ROOT, "content", "domande", d) for d in ("verificate", "pilot")]

CATEGORIE = {
    "Arte", "Cinema", "Cucina", "Curiosità", "Geografia", "Letteratura", "Lingua italiana", "Musica",
    "Natura e animali", "Scienza", "Sport", "Storia", "Tecnologia", "TV e spettacolo",
}
PRESENTATORI = {"professore", "regina", "palmino"}
VIETATE = ["tesori", "tesoro mio"]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", s).strip()


STOP = set("il lo la i gli le un una uno di da in con su per tra fra e o a al allo alla ai agli alle del dello della dei degli delle nel nella nei che chi quale quali qual cosa come quanto quanti quante quando dove si e è non piu".split())


def parole(s: str) -> set:
    return {w for w in norm(s).split() if w not in STOP and len(w) > 2}


def carica(path):
    d = json.load(open(path, encoding="utf8"))
    return d["questions"] if isinstance(d, dict) else d


def main(args):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    errori, avvisi = [], []
    viste = {}  # testo normalizzato -> origine
    firme = []  # (parole, risposta giusta normalizzata, origine)
    for base in ESISTENTI:
        for f in sorted(glob.glob(os.path.join(base, "*.json"))):
            for i, q in enumerate(carica(f), 1):
                o = f"{os.path.basename(base)}/{os.path.basename(f)}#{i}"
                viste.setdefault(norm(q["text"]), o)
                firme.append((parole(q["text"]), norm(q["answers"][q["correct"][0]]), o))

    tutti = sorted(glob.glob(os.path.join(NUOVE, "*.json")))
    scelti = [f for f in tutti if not args or os.path.basename(f) in args]
    totale = 0
    for f in tutti:
        nome = os.path.basename(f)
        try:
            qs = carica(f)
        except Exception as e:  # noqa: BLE001
            errori.append(f"{nome}: JSON non valido ({e})")
            continue
        for i, q in enumerate(qs, 1):
            o = f"{nome}#{i}"
            controlla = f in scelti
            def err(m):
                if controlla:
                    errori.append(f"{o}: {m}")
            t = q.get("text", "")
            if q.get("type") != "single":
                err("type deve essere \"single\"")
            if not (12 <= len(t) <= 220):
                err(f"testo lungo {len(t)} (12-220)")
            if not t.rstrip().endswith("?"):
                err("il testo deve finire con ?")
            a = q.get("answers", [])
            if len(a) != 4:
                err("servono 4 risposte")
            elif len({norm(x) for x in a}) != 4:
                err("risposte doppie")
            if any(not (1 <= len(x) <= 60) for x in a):
                err("risposta vuota o oltre 60 caratteri")
            c = q.get("correct")
            if not (isinstance(c, list) and len(c) == 1 and c[0] in (0, 1, 2, 3)):
                err("correct deve essere [0..3]")
            if q.get("category") not in CATEGORIE:
                err(f"categoria non ammessa: {q.get('category')}")
            if q.get("difficulty") not in (1, 2, 3, 4, 5):
                err("difficulty 1-5")
            if q.get("presenter") not in PRESENTATORI:
                err("presenter: professore/regina/palmino")
            if not q.get("notes"):
                err("notes obbligatorie (fonte o spiegazione della risposta)")
            if any(v in (t + " ".join(a)).lower() for v in VIETATE):
                err("parola vietata (tesori)")
            if c and isinstance(c, list) and len(a) == 4 and c[0] in (0, 1, 2, 3):
                giusta = norm(a[c[0]])
                if giusta and len(giusta) > 3 and giusta in norm(t):
                    err("la risposta giusta compare nel testo")
            n = norm(t)
            if n in viste and viste[n] != o:
                err(f"DOPPIONE di {viste[n]}")
            else:
                viste[n] = o
            if c and isinstance(c, list) and len(a) == 4 and c[0] in (0, 1, 2, 3):
                p, g = parole(t), norm(a[c[0]])
                for p2, g2, o2 in firme:
                    if g == g2 and p and p2 and len(p & p2) / len(p | p2) >= 0.6:
                        err(f"quasi doppione di {o2}")
                        break
                firme.append((p, g, o))
            totale += 1 if controlla else 0
    for e in errori:
        print("✖", e)
    for a in avvisi:
        print("!", a)
    print(f"\nDomande controllate: {totale} · errori: {len(errori)}")
    return 1 if errori else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

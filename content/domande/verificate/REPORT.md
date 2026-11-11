# Verifica domande pilot

Controllate tutte le 560 domande dei 14 file in `pilot/`: risposta giusta, ambiguità, dati che invecchiano, italiano, distrattori, difficoltà, contenuti delicati. I file corretti sono in questa cartella e ogni domanda tenuta ha `"verified": true`.

**Totale: 560 tenute su 560, 15 corrette, 0 rimosse.**

Nessuna risposta segnata come giusta era sbagliata. Le correzioni riguardano distrattori che si potevano contestare, testi imprecisi o non più attuali, una domanda con la risposta già nel testo e alcune difficoltà.

## Riepilogo per file

| File | Totali | Tenute | Corrette | Rimosse |
|---|---:|---:|---:|---:|
| arte | 40 | 40 | 0 | 0 |
| cinema | 40 | 40 | 1 | 0 |
| cucina | 40 | 40 | 2 | 0 |
| curiosita | 40 | 40 | 2 | 0 |
| geografia | 40 | 40 | 0 | 0 |
| letteratura | 40 | 40 | 1 | 0 |
| lingua-italiana | 40 | 40 | 1 | 0 |
| musica | 40 | 40 | 0 | 0 |
| natura-e-animali | 40 | 40 | 3 | 0 |
| scienza | 40 | 40 | 1 | 0 |
| sport | 40 | 40 | 2 | 0 |
| storia | 40 | 40 | 0 | 0 |
| tecnologia | 40 | 40 | 0 | 0 |
| tv-e-spettacolo | 40 | 40 | 2 | 0 |
| **Totale** | **560** | **560** | **15** | **0** |

## Correzioni

Il numero dopo # è la posizione della domanda nel file (da 1, uguale in pilot e verificate).

- **cinema** #39 — Quale film vinse il primo Oscar come miglior film nel 1929?
  - distrattore: "Aurora" → "Settimo cielo"
  - Motivo: "Aurora" vinse il premio "Unique and Artistic Production", all'epoca considerato di pari rango del miglior film: distrattore contestabile, sostituito con "Settimo cielo" (candidato, non vincitore)
- **cucina** #5 — Da quale Paese proviene il sushi?
  - testo: "Da quale Paese proviene il sushi?" → "Il sushi è un piatto tipico di quale Paese?"
  - Motivo: "Da quale Paese proviene" è contestabile (le origini remote del sushi sono in Cina/Sud-est asiatico): riformulata su "piatto tipico"
- **cucina** #40 — Che cosa misura la scala di Scoville?
  - difficoltà: 5 → 3
  - Motivo: La scala di Scoville è abbastanza nota, non da livello massimo
- **curiosita** #25 — Qual è la valuta ufficiale della Svizzera?
  - difficoltà: 3 → 2
  - Motivo: Domanda facile (franco svizzero)
- **curiosita** #26 — Come si chiama la paura dei ragni?
  - difficoltà: 3 → 2
  - Motivo: Domanda facile (aracnofobia)
- **letteratura** #39 — Come si chiama il cane che riconosce Ulisse al suo ritorno a Itaca?
  - difficoltà: 5 → 4
  - Motivo: Il cane Argo è nozione scolastica diffusa
- **lingua-italiana** #24 — Come si dice al plurale "il dio"?
  - distrattore: "Gli dii" → "I dio"
  - Motivo: "Gli dii" è un plurale letterario/poetico attestato nei dizionari: il distrattore poteva essere considerato corretto. Sostituito con "I dio"
- **natura-e-animali** #15 — Quale uccello, alto fino a 2,5 metri, è il più grande vivente?
  - testo: "Quale uccello, alto fino a 2,5 metri, è il più grande vivente?" → "Qual è il più grande uccello vivente, alto anche più di 2 metri?"
  - Motivo: Il testo diceva "alto fino a 2,5 metri", ma lo struzzo arriva a circa 2,7-2,8 m: dato impreciso, riformulato
- **natura-e-animali** #16 — Con che cosa respira il delfino?
  - distrattore: "Spiracoli" → "Trachee"
  - Motivo: "Spiracoli" era ambiguo: lo sfiatatoio dei cetacei si chiama anche "spiracolo". Sostituito con "Trachee"
- **natura-e-animali** #31 — Quale crostaceo vive dentro le conchiglie vuote di altri molluschi?
  - testo: "Quale crostaceo vive dentro le conchiglie vuote di altri molluschi?" → "Quale crostaceo vive dentro le conchiglie vuote dei molluschi?"; distrattore: "Granchio" → "Scampo"
  - Motivo: "di altri molluschi" faceva del paguro un mollusco; inoltre il paguro è chiamato anche "granchio eremita", quindi il distrattore "Granchio" era contestabile
- **scienza** #34 — Quale particella del nucleo atomico ha carica positiva?
  - difficoltà: 4 → 3
  - Motivo: Il protone è nozione da scuola media
- **sport** #22 — Quale stadio milanese è ufficialmente intitolato a Giuseppe Meazza?
  - testo: "Quale stadio milanese è ufficialmente intitolato a Giuseppe Meazza?" → "Lo stadio di San Siro a Milano è intitolato a quale ex calciatore?"; risposte: Stadio Olimpico / San Siro / Stadio Maradona / Stadio Franchi (giusta: San Siro) → Giuseppe Meazza / Silvio Piola / Valentino Mazzola / Giampiero Boniperti (giusta: Giuseppe Meazza)
  - Motivo: Il testo conteneva già il nome (Meazza) e chiedeva "San Siro" contro tre stadi non milanesi: risposta ovvia. Domanda ribaltata
- **sport** #37 — Quali di queste località hanno ospitato le Olimpiadi invernali? (più risposte)
  - distrattore: "Bolzano" → "Madonna di Campiglio"
  - Motivo: "Bolzano" contestabile dopo Milano Cortina 2026 (gare ad Anterselva, in provincia di Bolzano, e show olimpico al Palasport di Bolzano): sostituito con una località mai sede olimpica
- **tv-e-spettacolo** #20 — In quale fiction un prete detective è interpretato da Terence Hill?
  - testo: "In quale fiction un prete detective è interpretato da Terence Hill?" → "In quale fiction Terence Hill ha interpretato un prete detective?"
  - Motivo: Terence Hill ha lasciato "Don Matteo" nel 2022 (ora c'è Raoul Bova): "è interpretato" non è più vero, verbo al passato
- **tv-e-spettacolo** #39 — Chi ha creato la serie "I Simpson"?
  - difficoltà: 5 → 4
  - Motivo: Matt Groening è un nome abbastanza noto, non da livello massimo

## Rimozioni

Nessuna: tutte le domande sono risultate affidabili o correggibili.

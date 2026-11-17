import type { DilemmaInput } from "@/lib/tig/games/mechanics/dilemma-pubblico";

/**
 * 39 · IL DILEMMA PUBBLICO — risorse condivise. In ogni matrice competere conviene al singolo tavolo,
 * ma se abbastanza tavoli cooperano tutti stanno meglio che nel «tutti contro tutti».
 */
const varianti: DilemmaInput[] = [
  {
    id: "frigo-condiviso",
    story: "Il frigo condiviso",
    prompt: "Nel frigo di casa c'è l'ultima scorta comune. Rispettate i turni o vi servite prima degli altri?",
    coopLabel: "Rispettiamo i turni",
    competeLabel: "Ci serviamo prima",
    matrix: { threshold: 0.6, reached: { coop: 60, compete: 80 }, missed: { coop: 0, compete: 30 } },
    explain: "Se almeno il 60% dei tavoli rispettava i turni, la scorta bastava per tutti: 60 a chi cooperava, 80 a chi si serviva prima. Sotto soglia il frigo si svuotava: 30 ai più svelti, zero ai pazienti.",
  },
  {
    id: "cassa-viaggio",
    story: "La cassa comune del viaggio",
    prompt: "Viaggio di gruppo con cassa comune. Versate la vostra quota intera o fate i furbi con una quota ridotta?",
    coopLabel: "Quota intera",
    competeLabel: "Quota ridotta",
    matrix: { threshold: 0.5, reached: { coop: 55, compete: 75 }, missed: { coop: 5, compete: 25 } },
    explain: "Con almeno metà dei tavoli che versava la quota intera il viaggio si faceva: 55 a chi pagava tutto, 75 ai furbi. Sotto la metà saltava l'alloggio buono: 25 ai furbi, 5 agli onesti.",
  },
  {
    id: "playlist-festa",
    story: "La playlist della festa",
    prompt: "Playlist condivisa della festa: aggiungete un brano a testa o riempite la coda con i vostri preferiti?",
    coopLabel: "Un brano a testa",
    competeLabel: "Riempiamo la coda",
    matrix: { threshold: 0.7, reached: { coop: 70, compete: 90 }, missed: { coop: 10, compete: 40 } },
    explain: "Serviva il 70% dei tavoli corretti perché la festa funzionasse: 70 a chi metteva un brano, 90 a chi riempiva la coda. Sotto soglia la playlist diventava un caos: 40 a chi l'aveva occupata, 10 agli altri.",
  },
  {
    id: "fondo-caffe",
    story: "Il fondo caffè dell'ufficio",
    prompt: "In ufficio c'è un barattolo per comprare le capsule. Mettete la vostra parte o bevete a sbafo?",
    coopLabel: "Mettiamo la quota",
    competeLabel: "Beviamo a sbafo",
    matrix: { threshold: 0.6, reached: { coop: 50, compete: 70 }, missed: { coop: 0, compete: 20 } },
    explain: "Con almeno il 60% dei tavoli che pagava, il caffè non finiva mai: 50 a chi versava, 70 a chi beveva a sbafo. Sotto soglia la macchinetta restava vuota: 20 ai più svelti, zero a chi aveva pagato.",
  },
  {
    id: "lavastoviglie",
    story: "La lavastoviglie di casa",
    prompt: "Casa con cinque coinquilini: svuotate la lavastoviglie quando tocca a voi o fate finta di niente?",
    coopLabel: "La svuotiamo",
    competeLabel: "Facciamo finta di niente",
    matrix: { threshold: 0.5, reached: { coop: 60, compete: 85 }, missed: { coop: 10, compete: 35 } },
    explain: "Con almeno metà dei tavoli diligenti la cucina restava vivibile: 60 a chi svuotava, 85 a chi faceva finta di niente. Sotto la metà piatti ovunque: 35 agli scansafatiche, 10 agli altri.",
  },
  {
    id: "ombrelloni",
    story: "Gli ombrelloni in spiaggia",
    prompt: "Spiaggia libera, pochi posti all'ombra. Lasciate spazio agli altri o piazzate teli ovunque all'alba?",
    coopLabel: "Lasciamo spazio",
    competeLabel: "Teli ovunque",
    matrix: { threshold: 0.65, reached: { coop: 65, compete: 85 }, missed: { coop: 5, compete: 30 } },
    explain: "Serviva il 65% di tavoli corretti perché ci fosse ombra per tutti: 65 a chi lasciava spazio, 85 a chi occupava. Sotto soglia guerra dei teli: 30 a chi si era alzato all'alba, 5 agli altri.",
  },
  {
    id: "wifi-condominio",
    story: "Il wifi condiviso del condominio",
    prompt: "Il wifi è condiviso con i vicini. Usate la rete con giudizio o scaricate tutto la sera?",
    coopLabel: "Con giudizio",
    competeLabel: "Scarichiamo tutto",
    matrix: { threshold: 0.55, reached: { coop: 55, compete: 75 }, missed: { coop: 0, compete: 25 } },
    explain: "Con almeno il 55% dei tavoli prudenti la rete reggeva: 55 a chi usava con giudizio, 75 a chi scaricava. Sotto soglia tutto bloccato: 25 a chi si era preso la banda, zero agli altri.",
  },
];

export default varianti;

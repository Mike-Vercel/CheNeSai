import type { TempoFantasmaInput } from "@/lib/tig/games/mechanics/tempo-fantasma";

/**
 * 04 · TEMPO FANTASMA — varianti. Bersagli tra 10 e 15 secondi (difficoltà comparabile: più lungo il
 * tempo, più si sbaglia, ma il disturbo è più lento). Il disturbo in TV non batte mai i secondi.
 */
const varianti: TempoFantasmaInput[] = [
  {
    id: "vocale-12",
    theme: "Il vocale da 12 secondi",
    flavor: "Ti hanno detto «mandami un vocale breve». Breve vuol dire 12 secondi, non uno di più.",
    targetSec: 12,
    distractorBpm: 76,
    explain: "Bersaglio 12 secondi dal VIA. Il segnale in TV pulsava a 76 battiti al minuto: contarlo faceva arrivare in anticipo.",
  },
  {
    id: "microonde-15",
    theme: "Il microonde dell'ufficio",
    flavor: "C'è la fila al microonde e tu hai promesso solo 15 secondi. Tutti ti guardano.",
    targetSec: 15,
    distractorBpm: 50,
    explain: "Bersaglio 15 secondi dal VIA. Il disturbo a 50 battiti al minuto era più lento dei secondi: chi lo seguiva fermava tardi.",
  },
  {
    id: "storia-10",
    theme: "La storia che dura 10 secondi",
    flavor: "Una foto nelle storie resta 10 secondi. Fermate il tempo quando sparisce.",
    targetSec: 10,
    distractorBpm: 84,
    explain: "Bersaglio 10 secondi dal VIA. Il segnale a 84 battiti al minuto correva più dei secondi.",
  },
  {
    id: "semaforo-13",
    theme: "Il verde pedonale",
    flavor: "Il verde per attraversare dura 13 secondi e voi siete a metà strisce con le buste della spesa.",
    targetSec: 13,
    distractorBpm: 46,
    explain: "Bersaglio 13 secondi dal VIA. Il disturbo a 46 battiti al minuto spingeva a fermare in ritardo.",
  },
  {
    id: "videochiamata-11",
    theme: "Silenzio in videochiamata",
    flavor: "Il capo chiede «domande?». Dopo 11 secondi di silenzio chiude la call. Indovinate quando.",
    targetSec: 11,
    distractorBpm: 92,
    explain: "Bersaglio 11 secondi dal VIA. Il segnale a 92 battiti al minuto ingannava chi contava i lampi.",
  },
  {
    id: "ascensore-14",
    theme: "L'ascensore del condominio",
    flavor: "Dal piano terra al sesto ci vogliono 14 secondi esatti. Fermate quando si aprono le porte.",
    targetSec: 14,
    distractorBpm: 70,
    explain: "Bersaglio 14 secondi dal VIA. Il disturbo a 70 battiti al minuto era leggermente più veloce dei secondi.",
  },
  {
    id: "tostapane-12",
    theme: "Il toast del coinquilino",
    flavor: "Il coinquilino giura che il toast perfetto si toglie a 12 secondi dal clic. Mettetelo alla prova.",
    targetSec: 12,
    distractorBpm: 52,
    explain: "Bersaglio 12 secondi dal VIA. Il disturbo a 52 battiti al minuto rallentava il conto.",
  },
  {
    id: "capodanno-10",
    theme: "Il conto alla rovescia di Capodanno",
    flavor: "Il gruppo ha sbagliato a far partire il conto: parte a 10. Fermate lo zero, non un secondo dopo.",
    targetSec: 10,
    distractorBpm: 100,
    explain: "Bersaglio 10 secondi dal VIA. Il segnale a 100 battiti al minuto era molto più rapido dei secondi.",
  },
];

export default varianti;

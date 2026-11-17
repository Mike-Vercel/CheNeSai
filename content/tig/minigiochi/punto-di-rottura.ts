import type { RotturaInput } from "@/lib/tig/games/mechanics/punto-di-rottura";

/**
 * 70 · PUNTO DI ROTTURA — alberi a bivi (3 × 2 × 2 = 12 percorsi) con due risorse a limite e un obiettivo.
 * I costi sono plausibili; i punti «obiettivo» sono stati scelti con uno script di ricerca perché ogni albero abbia
 * un ottimo UNICO, da 3 a 6 percorsi che si rompono e la prima scelta più golosa che NON porta all'ottimo
 * (lo schema lo verifica di nuovo a ogni avvio).
 */
const varianti: RotturaInput[] = [
  {
    id: "sabato-perfetto",
    difficulty: "facile",
    title: "Il sabato perfetto",
    intro: "Sabato libero, 55 euro in tasca e sei ore (360 minuti) prima di crollare. Ogni scelta cambia cosa resta da fare dopo: massimo divertimento senza sforare.",
    resources: [
      {
        id: "euro",
        label: "Budget",
        unit: "€",
        limit: 55
      },
      {
        id: "min",
        label: "Tempo",
        unit: "min",
        limit: 360
      }
    ],
    goal: {
      label: "Divertimento",
      unit: "stelle"
    },
    steps: [
      "Come inizia il pomeriggio?",
      "E poi?",
      "Come chiudete la serata?"
    ],
    tree: [
      {
        id: "a",
        text: "Brunch in centro",
        use: {
          euro: 25,
          min: 120
        },
        gain: 6,
        next: [
          {
            id: "aa",
            text: "Mostra temporanea",
            use: {
              euro: 15,
              min: 90
            },
            gain: 4,
            next: [
              {
                id: "aaa",
                text: "Cena al ristorante etnico",
                use: {
                  euro: 30,
                  min: 120
                },
                gain: 8
              },
              {
                id: "aab",
                text: "Pizza al taglio sul lungofiume",
                use: {
                  euro: 10,
                  min: 60
                },
                gain: 5
              }
            ]
          },
          {
            id: "ab",
            text: "Passeggiata al parco",
            use: {
              euro: 0,
              min: 60
            },
            gain: 4,
            next: [
              {
                id: "aba",
                text: "Karaoke con gli amici",
                use: {
                  euro: 20,
                  min: 150
                },
                gain: 9
              },
              {
                id: "abb",
                text: "Cinema all'aperto",
                use: {
                  euro: 8,
                  min: 120
                },
                gain: 4
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Partita a padel",
        use: {
          euro: 12,
          min: 90
        },
        gain: 6,
        next: [
          {
            id: "ba",
            text: "Aperitivo lungo",
            use: {
              euro: 18,
              min: 120
            },
            gain: 7,
            next: [
              {
                id: "baa",
                text: "Concerto gratis in piazza",
                use: {
                  euro: 0,
                  min: 120
                },
                gain: 8
              },
              {
                id: "bab",
                text: "Escape room",
                use: {
                  euro: 25,
                  min: 90
                },
                gain: 9
              }
            ]
          },
          {
            id: "bb",
            text: "Mercatino vintage",
            use: {
              euro: 10,
              min: 90
            },
            gain: 4,
            next: [
              {
                id: "bba",
                text: "Cena al ristorante etnico",
                use: {
                  euro: 30,
                  min: 120
                },
                gain: 8
              },
              {
                id: "bbb",
                text: "Concerto gratis in piazza",
                use: {
                  euro: 0,
                  min: 120
                },
                gain: 8
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Giro in kayak sul lago",
        use: {
          euro: 30,
          min: 150
        },
        gain: 9,
        next: [
          {
            id: "ca",
            text: "Aperitivo lungo",
            use: {
              euro: 18,
              min: 120
            },
            gain: 7,
            next: [
              {
                id: "caa",
                text: "Karaoke con gli amici",
                use: {
                  euro: 20,
                  min: 150
                },
                gain: 9
              },
              {
                id: "cab",
                text: "Pizza al taglio sul lungofiume",
                use: {
                  euro: 10,
                  min: 60
                },
                gain: 5
              }
            ]
          },
          {
            id: "cb",
            text: "Doccia e riposino",
            use: {
              euro: 0,
              min: 60
            },
            gain: 2,
            next: [
              {
                id: "cba",
                text: "Escape room",
                use: {
                  euro: 25,
                  min: 90
                },
                gain: 9
              },
              {
                id: "cbb",
                text: "Concerto gratis in piazza",
                use: {
                  euro: 0,
                  min: 120
                },
                gain: 8
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "b",
        "ba",
        "bab"
      ]
    },
    explain: "Il percorso migliore è «Partita a padel», «Aperitivo lungo», «Escape room»: 22 stelle con 55 € e 300 min (limiti 55 € e 360 min). Partire da «Giro in kayak sul lago», la scelta più golosa, porta al massimo a 20 stelle. 3 percorsi su 12 si rompono."
  },
  {
    id: "cena-per-otto",
    difficulty: "facile",
    title: "La cena per otto",
    intro: "Otto amici a cena da voi, 60 euro di spesa e 200 minuti prima che suoni il citofono. L'antipasto decide il primo, il primo decide il dolce.",
    resources: [
      {
        id: "euro",
        label: "Spesa",
        unit: "€",
        limit: 60
      },
      {
        id: "min",
        label: "Tempo",
        unit: "min",
        limit: 200
      }
    ],
    goal: {
      label: "Gradimento",
      unit: "stelle"
    },
    steps: [
      "Che antipasto?",
      "Che primo?",
      "E il dolce?"
    ],
    tree: [
      {
        id: "a",
        text: "Tagliere di salumi e formaggi",
        use: {
          euro: 35,
          min: 15
        },
        gain: 8,
        next: [
          {
            id: "aa",
            text: "Lasagne fatte in casa",
            use: {
              euro: 30,
              min: 150
            },
            gain: 8,
            next: [
              {
                id: "aaa",
                text: "Tiramisù",
                use: {
                  euro: 15,
                  min: 60
                },
                gain: 8
              },
              {
                id: "aab",
                text: "Gelato comprato",
                use: {
                  euro: 12,
                  min: 5
                },
                gain: 4
              }
            ]
          },
          {
            id: "ab",
            text: "Pasta al pomodoro fresco",
            use: {
              euro: 10,
              min: 40
            },
            gain: 5,
            next: [
              {
                id: "aba",
                text: "Crostata della nonna",
                use: {
                  euro: 10,
                  min: 90
                },
                gain: 6
              },
              {
                id: "abb",
                text: "Frutta tagliata",
                use: {
                  euro: 8,
                  min: 20
                },
                gain: 3
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Bruschette miste",
        use: {
          euro: 12,
          min: 40
        },
        gain: 4,
        next: [
          {
            id: "ba",
            text: "Risotto ai funghi",
            use: {
              euro: 25,
              min: 60
            },
            gain: 8,
            next: [
              {
                id: "baa",
                text: "Tiramisù",
                use: {
                  euro: 15,
                  min: 60
                },
                gain: 8
              },
              {
                id: "bab",
                text: "Crostata della nonna",
                use: {
                  euro: 10,
                  min: 90
                },
                gain: 6
              }
            ]
          },
          {
            id: "bb",
            text: "Lasagne fatte in casa",
            use: {
              euro: 30,
              min: 150
            },
            gain: 8,
            next: [
              {
                id: "bba",
                text: "Gelato comprato",
                use: {
                  euro: 12,
                  min: 5
                },
                gain: 4
              },
              {
                id: "bbb",
                text: "Frutta tagliata",
                use: {
                  euro: 8,
                  min: 20
                },
                gain: 3
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Polpettine fritte",
        use: {
          euro: 20,
          min: 70
        },
        gain: 6,
        next: [
          {
            id: "ca",
            text: "Risotto ai funghi",
            use: {
              euro: 25,
              min: 60
            },
            gain: 8,
            next: [
              {
                id: "caa",
                text: "Tiramisù",
                use: {
                  euro: 15,
                  min: 60
                },
                gain: 8
              },
              {
                id: "cab",
                text: "Gelato comprato",
                use: {
                  euro: 12,
                  min: 5
                },
                gain: 4
              }
            ]
          },
          {
            id: "cb",
            text: "Pasta al pomodoro fresco",
            use: {
              euro: 10,
              min: 40
            },
            gain: 5,
            next: [
              {
                id: "cba",
                text: "Crostata della nonna",
                use: {
                  euro: 10,
                  min: 90
                },
                gain: 6
              },
              {
                id: "cbb",
                text: "Tiramisù",
                use: {
                  euro: 15,
                  min: 60
                },
                gain: 8
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "c",
        "ca",
        "caa"
      ]
    },
    explain: "Il percorso migliore è «Polpettine fritte», «Risotto ai funghi», «Tiramisù»: 22 stelle con 60 € e 190 min (limiti 60 € e 200 min). Partire da «Tagliere di salumi e formaggi», la scelta più golosa, porta al massimo a 19 stelle. 3 percorsi su 12 si rompono."
  },
  {
    id: "primo-appuntamento",
    difficulty: "facile",
    title: "Il primo appuntamento",
    intro: "Primo appuntamento: 70 euro e tre ore (180 minuti) prima che lei prenda l'ultimo treno. Il punto d'incontro decide cosa fate, e cosa fate decide il finale.",
    resources: [
      {
        id: "euro",
        label: "Budget",
        unit: "€",
        limit: 70
      },
      {
        id: "min",
        label: "Tempo",
        unit: "min",
        limit: 180
      }
    ],
    goal: {
      label: "Impressione",
      unit: "stelle"
    },
    steps: [
      "Dove vi vedete?",
      "Cosa fate?",
      "Il finale?"
    ],
    tree: [
      {
        id: "a",
        text: "Aperitivo in terrazza",
        use: {
          euro: 30,
          min: 60
        },
        gain: 7,
        next: [
          {
            id: "aa",
            text: "Cena in trattoria",
            use: {
              euro: 40,
              min: 90
            },
            gain: 7,
            next: [
              {
                id: "aaa",
                text: "Passeggiata fino alla stazione",
                use: {
                  euro: 0,
                  min: 20
                },
                gain: 6
              },
              {
                id: "aab",
                text: "Gelato a metà strada",
                use: {
                  euro: 8,
                  min: 30
                },
                gain: 6
              }
            ]
          },
          {
            id: "ab",
            text: "Mostra fotografica",
            use: {
              euro: 12,
              min: 60
            },
            gain: 7,
            next: [
              {
                id: "aba",
                text: "Gelato a metà strada",
                use: {
                  euro: 8,
                  min: 30
                },
                gain: 6
              },
              {
                id: "abb",
                text: "Passeggiata fino alla stazione",
                use: {
                  euro: 0,
                  min: 20
                },
                gain: 6
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Caffè al bar del parco",
        use: {
          euro: 6,
          min: 30
        },
        gain: 5,
        next: [
          {
            id: "ba",
            text: "Giro in barca a remi",
            use: {
              euro: 20,
              min: 60
            },
            gain: 9,
            next: [
              {
                id: "baa",
                text: "Cena in trattoria",
                use: {
                  euro: 40,
                  min: 90
                },
                gain: 7
              },
              {
                id: "bab",
                text: "Gelato a metà strada",
                use: {
                  euro: 8,
                  min: 30
                },
                gain: 6
              }
            ]
          },
          {
            id: "bb",
            text: "Mostra fotografica",
            use: {
              euro: 12,
              min: 60
            },
            gain: 7,
            next: [
              {
                id: "bba",
                text: "Cena in trattoria",
                use: {
                  euro: 40,
                  min: 90
                },
                gain: 7
              },
              {
                id: "bbb",
                text: "Passeggiata fino alla stazione",
                use: {
                  euro: 0,
                  min: 20
                },
                gain: 6
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Bowling",
        use: {
          euro: 24,
          min: 75
        },
        gain: 5,
        next: [
          {
            id: "ca",
            text: "Panino al chiosco",
            use: {
              euro: 12,
              min: 30
            },
            gain: 3,
            next: [
              {
                id: "caa",
                text: "Gelato a metà strada",
                use: {
                  euro: 8,
                  min: 30
                },
                gain: 6
              },
              {
                id: "cab",
                text: "Passeggiata fino alla stazione",
                use: {
                  euro: 0,
                  min: 20
                },
                gain: 6
              }
            ]
          },
          {
            id: "cb",
            text: "Cena in trattoria",
            use: {
              euro: 40,
              min: 90
            },
            gain: 7,
            next: [
              {
                id: "cba",
                text: "Passeggiata fino alla stazione",
                use: {
                  euro: 0,
                  min: 20
                },
                gain: 6
              },
              {
                id: "cbb",
                text: "Gelato a metà strada",
                use: {
                  euro: 8,
                  min: 30
                },
                gain: 6
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "b",
        "ba",
        "baa"
      ]
    },
    explain: "Il percorso migliore è «Caffè al bar del parco», «Giro in barca a remi», «Cena in trattoria»: 21 stelle con 66 € e 180 min (limiti 70 € e 180 min). Partire da «Aperitivo in terrazza», la scelta più golosa, porta al massimo a 20 stelle. 3 percorsi su 12 si rompono."
  },
  {
    id: "trasloco-in-un-giorno",
    difficulty: "media",
    title: "Il trasloco in un giorno",
    intro: "Domenica si cambia casa: 200 euro e 12 ore di luce. Chi vi aiuta decide come portate i mobili, e come li portate decide come finisce la giornata.",
    resources: [
      {
        id: "euro",
        label: "Budget",
        unit: "€",
        limit: 200
      },
      {
        id: "ore",
        label: "Tempo",
        unit: "ore",
        limit: 12
      }
    ],
    goal: {
      label: "Casa pronta",
      unit: "stelle"
    },
    steps: [
      "Chi vi aiuta?",
      "Come portate i mobili?",
      "Come chiudete la giornata?"
    ],
    tree: [
      {
        id: "a",
        text: "Ditta di traslochi",
        use: {
          euro: 160,
          ore: 4
        },
        gain: 8,
        next: [
          {
            id: "aa",
            text: "Montaggio mobili incluso",
            use: {
              euro: 50,
              ore: 2
            },
            gain: 9,
            next: [
              {
                id: "aaa",
                text: "Pizza d'asporto per tutti",
                use: {
                  euro: 40,
                  ore: 1
                },
                gain: 2
              },
              {
                id: "aab",
                text: "Pulizie della casa vecchia",
                use: {
                  euro: 0,
                  ore: 4
                },
                gain: 5
              }
            ]
          },
          {
            id: "ab",
            text: "Montate voi i mobili",
            use: {
              euro: 0,
              ore: 5
            },
            gain: 5,
            next: [
              {
                id: "aba",
                text: "Pizza d'asporto per tutti",
                use: {
                  euro: 40,
                  ore: 1
                },
                gain: 2
              },
              {
                id: "abb",
                text: "Pulizie della casa vecchia",
                use: {
                  euro: 0,
                  ore: 4
                },
                gain: 5
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Amici con furgone a noleggio",
        use: {
          euro: 90,
          ore: 6
        },
        gain: 6,
        next: [
          {
            id: "ba",
            text: "Due viaggi col furgone",
            use: {
              euro: 40,
              ore: 3
            },
            gain: 7,
            next: [
              {
                id: "baa",
                text: "Cena offerta agli amici",
                use: {
                  euro: 70,
                  ore: 2
                },
                gain: 5
              },
              {
                id: "bab",
                text: "Pizza sul pavimento",
                use: {
                  euro: 30,
                  ore: 1
                },
                gain: 3
              }
            ]
          },
          {
            id: "bb",
            text: "Un viaggio solo, stipando tutto",
            use: {
              euro: 0,
              ore: 2
            },
            gain: 3,
            next: [
              {
                id: "bba",
                text: "Cena offerta agli amici",
                use: {
                  euro: 70,
                  ore: 2
                },
                gain: 5
              },
              {
                id: "bbb",
                text: "Montaggio notturno dei mobili",
                use: {
                  euro: 0,
                  ore: 3
                },
                gain: 6
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Da soli con la vostra auto",
        use: {
          euro: 20,
          ore: 8
        },
        gain: 3,
        next: [
          {
            id: "ca",
            text: "Lasciate mezza roba dai genitori",
            use: {
              euro: 0,
              ore: 1
            },
            gain: 3,
            next: [
              {
                id: "caa",
                text: "Pizza sul pavimento",
                use: {
                  euro: 30,
                  ore: 1
                },
                gain: 3
              },
              {
                id: "cab",
                text: "Pulizie della casa vecchia",
                use: {
                  euro: 0,
                  ore: 4
                },
                gain: 5
              }
            ]
          },
          {
            id: "cb",
            text: "Noleggiate un carrello",
            use: {
              euro: 50,
              ore: 2
            },
            gain: 5,
            next: [
              {
                id: "cba",
                text: "Montaggio notturno dei mobili",
                use: {
                  euro: 0,
                  ore: 3
                },
                gain: 6
              },
              {
                id: "cbb",
                text: "Pizza sul pavimento",
                use: {
                  euro: 30,
                  ore: 1
                },
                gain: 3
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "b",
        "ba",
        "baa"
      ]
    },
    explain: "Il percorso migliore è «Amici con furgone a noleggio», «Due viaggi col furgone», «Cena offerta agli amici»: 18 stelle con 200 € e 11 ore (limiti 200 € e 12 ore). Partire da «Ditta di traslochi», la scelta più golosa, porta al massimo a 15 stelle. 5 percorsi su 12 si rompono."
  },
  {
    id: "weekend-citta-arte",
    difficulty: "media",
    title: "Il weekend in città d'arte",
    intro: "Due giorni in una città d'arte con 260 euro a testa e 16 ore utili tra visite e spostamenti. Il viaggio decide dove dormite, l'alloggio decide cosa riuscite a vedere.",
    resources: [
      {
        id: "euro",
        label: "Budget",
        unit: "€",
        limit: 260
      },
      {
        id: "ore",
        label: "Tempo",
        unit: "ore",
        limit: 16
      }
    ],
    goal: {
      label: "Ricordi",
      unit: "stelle"
    },
    steps: [
      "Come ci arrivate?",
      "Dove dormite?",
      "Cosa vedete?"
    ],
    tree: [
      {
        id: "a",
        text: "Treno veloce",
        use: {
          euro: 120,
          ore: 3
        },
        gain: 6,
        next: [
          {
            id: "aa",
            text: "Hotel in centro",
            use: {
              euro: 140,
              ore: 0
            },
            gain: 7,
            next: [
              {
                id: "aaa",
                text: "Tour guidato dei musei",
                use: {
                  euro: 60,
                  ore: 8
                },
                gain: 8
              },
              {
                id: "aab",
                text: "Giro a piedi con la mappa",
                use: {
                  euro: 0,
                  ore: 10
                },
                gain: 5
              }
            ]
          },
          {
            id: "ab",
            text: "Ostello vicino alla stazione",
            use: {
              euro: 50,
              ore: 2
            },
            gain: 4,
            next: [
              {
                id: "aba",
                text: "Tour guidato dei musei",
                use: {
                  euro: 60,
                  ore: 8
                },
                gain: 8
              },
              {
                id: "abb",
                text: "Gita in battello",
                use: {
                  euro: 35,
                  ore: 6
                },
                gain: 6
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Auto in condivisione",
        use: {
          euro: 60,
          ore: 6
        },
        gain: 5,
        next: [
          {
            id: "ba",
            text: "Agriturismo fuori città",
            use: {
              euro: 90,
              ore: 3
            },
            gain: 8,
            next: [
              {
                id: "baa",
                text: "Tour guidato dei musei",
                use: {
                  euro: 60,
                  ore: 8
                },
                gain: 8
              },
              {
                id: "bab",
                text: "Giro a piedi con la mappa",
                use: {
                  euro: 0,
                  ore: 10
                },
                gain: 5
              }
            ]
          },
          {
            id: "bb",
            text: "Hotel in centro",
            use: {
              euro: 140,
              ore: 0
            },
            gain: 7,
            next: [
              {
                id: "bba",
                text: "Gita in battello",
                use: {
                  euro: 35,
                  ore: 6
                },
                gain: 6
              },
              {
                id: "bbb",
                text: "Tour guidato dei musei",
                use: {
                  euro: 60,
                  ore: 8
                },
                gain: 8
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Volo low cost",
        use: {
          euro: 90,
          ore: 4
        },
        gain: 8,
        next: [
          {
            id: "ca",
            text: "Hotel in centro",
            use: {
              euro: 140,
              ore: 0
            },
            gain: 7,
            next: [
              {
                id: "caa",
                text: "Tour guidato dei musei",
                use: {
                  euro: 60,
                  ore: 8
                },
                gain: 8
              },
              {
                id: "cab",
                text: "Gita in battello",
                use: {
                  euro: 35,
                  ore: 6
                },
                gain: 6
              }
            ]
          },
          {
            id: "cb",
            text: "Ostello vicino alla stazione",
            use: {
              euro: 50,
              ore: 2
            },
            gain: 4,
            next: [
              {
                id: "cba",
                text: "Giro a piedi con la mappa",
                use: {
                  euro: 0,
                  ore: 10
                },
                gain: 5
              },
              {
                id: "cbb",
                text: "Gita in battello",
                use: {
                  euro: 35,
                  ore: 6
                },
                gain: 6
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "b",
        "bb",
        "bbb"
      ]
    },
    explain: "Il percorso migliore è «Auto in condivisione», «Hotel in centro», «Tour guidato dei musei»: 20 stelle con 260 € e 14 ore (limiti 260 € e 16 ore). Partire da «Volo low cost», la scelta più golosa, porta al massimo a 18 stelle. 5 percorsi su 12 si rompono."
  },
  {
    id: "festa-a-sorpresa",
    difficulty: "media",
    title: "La festa a sorpresa",
    intro: "Festa a sorpresa per la coinquilina: 120 euro raccolti in chat e 260 minuti mentre lei è al lavoro. Il posto decide la musica, la musica decide il gran finale.",
    resources: [
      {
        id: "euro",
        label: "Cassa comune",
        unit: "€",
        limit: 120
      },
      {
        id: "min",
        label: "Tempo",
        unit: "min",
        limit: 260
      }
    ],
    goal: {
      label: "Effetto sorpresa",
      unit: "stelle"
    },
    steps: [
      "Dove la fate?",
      "Che musica?",
      "Il gran finale?"
    ],
    tree: [
      {
        id: "a",
        text: "Sala del bar sotto casa",
        use: {
          euro: 60,
          min: 30
        },
        gain: 8,
        next: [
          {
            id: "aa",
            text: "Dj di un amico",
            use: {
              euro: 30,
              min: 60
            },
            gain: 8,
            next: [
              {
                id: "aaa",
                text: "Torta a tema",
                use: {
                  euro: 40,
                  min: 30
                },
                gain: 8
              },
              {
                id: "aab",
                text: "Video con i messaggi di tutti",
                use: {
                  euro: 0,
                  min: 150
                },
                gain: 8
              }
            ]
          },
          {
            id: "ab",
            text: "Playlist condivisa",
            use: {
              euro: 0,
              min: 20
            },
            gain: 4,
            next: [
              {
                id: "aba",
                text: "Torta a tema",
                use: {
                  euro: 40,
                  min: 30
                },
                gain: 8
              },
              {
                id: "abb",
                text: "Coriandoli e cartellone",
                use: {
                  euro: 10,
                  min: 60
                },
                gain: 5
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Salotto di casa",
        use: {
          euro: 0,
          min: 120
        },
        gain: 5,
        next: [
          {
            id: "ba",
            text: "Dj di un amico",
            use: {
              euro: 30,
              min: 60
            },
            gain: 8,
            next: [
              {
                id: "baa",
                text: "Torta a tema",
                use: {
                  euro: 40,
                  min: 30
                },
                gain: 8
              },
              {
                id: "bab",
                text: "Coriandoli e cartellone",
                use: {
                  euro: 10,
                  min: 60
                },
                gain: 5
              }
            ]
          },
          {
            id: "bb",
            text: "Karaoke in salotto",
            use: {
              euro: 25,
              min: 40
            },
            gain: 6,
            next: [
              {
                id: "bba",
                text: "Video con i messaggi di tutti",
                use: {
                  euro: 0,
                  min: 150
                },
                gain: 8
              },
              {
                id: "bbb",
                text: "Torta a tema",
                use: {
                  euro: 40,
                  min: 30
                },
                gain: 8
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Terrazza in affitto",
        use: {
          euro: 90,
          min: 60
        },
        gain: 9,
        next: [
          {
            id: "ca",
            text: "Playlist condivisa",
            use: {
              euro: 0,
              min: 20
            },
            gain: 4,
            next: [
              {
                id: "caa",
                text: "Coriandoli e cartellone",
                use: {
                  euro: 10,
                  min: 60
                },
                gain: 5
              },
              {
                id: "cab",
                text: "Torta a tema",
                use: {
                  euro: 40,
                  min: 30
                },
                gain: 8
              }
            ]
          },
          {
            id: "cb",
            text: "Dj di un amico",
            use: {
              euro: 30,
              min: 60
            },
            gain: 8,
            next: [
              {
                id: "cba",
                text: "Video con i messaggi di tutti",
                use: {
                  euro: 0,
                  min: 150
                },
                gain: 8
              },
              {
                id: "cbb",
                text: "Coriandoli e cartellone",
                use: {
                  euro: 10,
                  min: 60
                },
                gain: 5
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "a",
        "aa",
        "aab"
      ]
    },
    explain: "Il percorso migliore è «Sala del bar sotto casa», «Dj di un amico», «Video con i messaggi di tutti»: 24 stelle con 90 € e 240 min (limiti 120 € e 260 min). Partire da «Terrazza in affitto», la scelta più golosa, porta al massimo a 18 stelle. 5 percorsi su 12 si rompono."
  },
  {
    id: "palestra-di-gennaio",
    difficulty: "media",
    title: "Il piano di gennaio",
    intro: "Buoni propositi: 140 euro e 12 ore al mese per rimettervi in forma. L'abbonamento decide l'allenamento, l'allenamento decide il premio del mese.",
    resources: [
      {
        id: "euro",
        label: "Budget",
        unit: "€",
        limit: 140
      },
      {
        id: "ore",
        label: "Tempo",
        unit: "ore",
        limit: 12
      }
    ],
    goal: {
      label: "Forma",
      unit: "stelle"
    },
    steps: [
      "Che abbonamento?",
      "Come vi allenate?",
      "Il premio del mese?"
    ],
    tree: [
      {
        id: "a",
        text: "Palestra con tutto incluso",
        use: {
          euro: 90,
          ore: 0
        },
        gain: 6,
        next: [
          {
            id: "aa",
            text: "Personal trainer due volte",
            use: {
              euro: 50,
              ore: 2
            },
            gain: 9,
            next: [
              {
                id: "aaa",
                text: "Massaggio sportivo",
                use: {
                  euro: 40,
                  ore: 1
                },
                gain: 5
              },
              {
                id: "aab",
                text: "Gita in montagna",
                use: {
                  euro: 10,
                  ore: 6
                },
                gain: 6
              }
            ]
          },
          {
            id: "ab",
            text: "Corsi di gruppo serali",
            use: {
              euro: 0,
              ore: 8
            },
            gain: 7,
            next: [
              {
                id: "aba",
                text: "Gita in montagna",
                use: {
                  euro: 10,
                  ore: 6
                },
                gain: 6
              },
              {
                id: "abb",
                text: "Scarpe nuove da corsa",
                use: {
                  euro: 60,
                  ore: 0
                },
                gain: 5
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Piscina comunale",
        use: {
          euro: 40,
          ore: 0
        },
        gain: 4,
        next: [
          {
            id: "ba",
            text: "Nuoto tre volte a settimana",
            use: {
              euro: 0,
              ore: 9
            },
            gain: 8,
            next: [
              {
                id: "baa",
                text: "Massaggio sportivo",
                use: {
                  euro: 40,
                  ore: 1
                },
                gain: 5
              },
              {
                id: "bab",
                text: "Gita in montagna",
                use: {
                  euro: 10,
                  ore: 6
                },
                gain: 6
              }
            ]
          },
          {
            id: "bb",
            text: "Acquagym con gli amici",
            use: {
              euro: 20,
              ore: 4
            },
            gain: 6,
            next: [
              {
                id: "bba",
                text: "Gita in montagna",
                use: {
                  euro: 10,
                  ore: 6
                },
                gain: 6
              },
              {
                id: "bbb",
                text: "Scarpe nuove da corsa",
                use: {
                  euro: 60,
                  ore: 0
                },
                gain: 5
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Corsa al parco, gratis",
        use: {
          euro: 0,
          ore: 0
        },
        gain: 3,
        next: [
          {
            id: "ca",
            text: "Programma con app a pagamento",
            use: {
              euro: 30,
              ore: 8
            },
            gain: 6,
            next: [
              {
                id: "caa",
                text: "Scarpe nuove da corsa",
                use: {
                  euro: 60,
                  ore: 0
                },
                gain: 5
              },
              {
                id: "cab",
                text: "Massaggio sportivo",
                use: {
                  euro: 40,
                  ore: 1
                },
                gain: 5
              }
            ]
          },
          {
            id: "cb",
            text: "Gruppo di corsa del quartiere",
            use: {
              euro: 0,
              ore: 10
            },
            gain: 8,
            next: [
              {
                id: "cba",
                text: "Gita in montagna",
                use: {
                  euro: 10,
                  ore: 6
                },
                gain: 6
              },
              {
                id: "cbb",
                text: "Scarpe nuove da corsa",
                use: {
                  euro: 60,
                  ore: 0
                },
                gain: 5
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "b",
        "ba",
        "baa"
      ]
    },
    explain: "Il percorso migliore è «Piscina comunale», «Nuoto tre volte a settimana», «Massaggio sportivo»: 17 stelle con 80 € e 10 ore (limiti 140 € e 12 ore). Partire da «Palestra con tutto incluso», la scelta più golosa, fa sforare qualunque percorso. 6 percorsi su 12 si rompono."
  },
  {
    id: "matrimonio-amica",
    difficulty: "difficile",
    title: "Il matrimonio dell'amica",
    intro: "La vostra amica si sposa a 300 km. Avete 400 euro e 3 giorni di ferie: il vestito pesa sul budget, il viaggio sui giorni, il regalo su tutti e due.",
    resources: [
      {
        id: "euro",
        label: "Budget",
        unit: "€",
        limit: 400
      },
      {
        id: "giorni",
        label: "Ferie",
        unit: "giorni",
        limit: 3
      }
    ],
    goal: {
      label: "Figura fatta",
      unit: "stelle"
    },
    steps: [
      "Il vestito?",
      "Come ci andate?",
      "Il regalo?"
    ],
    tree: [
      {
        id: "a",
        text: "Abito nuovo su misura",
        use: {
          euro: 220,
          giorni: 0
        },
        gain: 8,
        next: [
          {
            id: "aa",
            text: "Treno e notte in hotel",
            use: {
              euro: 150,
              giorni: 2
            },
            gain: 6,
            next: [
              {
                id: "aaa",
                text: "Busta generosa",
                use: {
                  euro: 100,
                  giorni: 0
                },
                gain: 9
              },
              {
                id: "aab",
                text: "Regalo dalla lista nozze",
                use: {
                  euro: 60,
                  giorni: 0
                },
                gain: 6
              }
            ]
          },
          {
            id: "ab",
            text: "Andata e ritorno in auto in giornata",
            use: {
              euro: 60,
              giorni: 1
            },
            gain: 3,
            next: [
              {
                id: "aba",
                text: "Busta generosa",
                use: {
                  euro: 100,
                  giorni: 0
                },
                gain: 9
              },
              {
                id: "abb",
                text: "Album di foto fatto a mano",
                use: {
                  euro: 20,
                  giorni: 1
                },
                gain: 7
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Abito in prestito da un'amica",
        use: {
          euro: 0,
          giorni: 0
        },
        gain: 5,
        next: [
          {
            id: "ba",
            text: "Treno e notte in hotel",
            use: {
              euro: 150,
              giorni: 2
            },
            gain: 6,
            next: [
              {
                id: "baa",
                text: "Busta generosa",
                use: {
                  euro: 100,
                  giorni: 0
                },
                gain: 9
              },
              {
                id: "bab",
                text: "Album di foto fatto a mano",
                use: {
                  euro: 20,
                  giorni: 1
                },
                gain: 7
              }
            ]
          },
          {
            id: "bb",
            text: "Tre giorni con visita della zona",
            use: {
              euro: 230,
              giorni: 3
            },
            gain: 9,
            next: [
              {
                id: "bba",
                text: "Regalo dalla lista nozze",
                use: {
                  euro: 60,
                  giorni: 0
                },
                gain: 6
              },
              {
                id: "bbb",
                text: "Busta generosa",
                use: {
                  euro: 100,
                  giorni: 0
                },
                gain: 9
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Abito usato di qualità",
        use: {
          euro: 90,
          giorni: 0
        },
        gain: 5,
        next: [
          {
            id: "ca",
            text: "Tre giorni con visita della zona",
            use: {
              euro: 230,
              giorni: 3
            },
            gain: 9,
            next: [
              {
                id: "caa",
                text: "Album di foto fatto a mano",
                use: {
                  euro: 20,
                  giorni: 1
                },
                gain: 7
              },
              {
                id: "cab",
                text: "Regalo dalla lista nozze",
                use: {
                  euro: 60,
                  giorni: 0
                },
                gain: 6
              }
            ]
          },
          {
            id: "cb",
            text: "Andata e ritorno in auto in giornata",
            use: {
              euro: 60,
              giorni: 1
            },
            gain: 3,
            next: [
              {
                id: "cba",
                text: "Busta generosa",
                use: {
                  euro: 100,
                  giorni: 0
                },
                gain: 9
              },
              {
                id: "cbb",
                text: "Regalo dalla lista nozze",
                use: {
                  euro: 60,
                  giorni: 0
                },
                gain: 6
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "b",
        "bb",
        "bbb"
      ]
    },
    explain: "Il percorso migliore è «Abito in prestito da un'amica», «Tre giorni con visita della zona», «Busta generosa»: 23 stelle con 330 € e 3 giorni (limiti 400 € e 3 giorni). Partire da «Abito nuovo su misura», la scelta più golosa, porta al massimo a 20 stelle. 3 percorsi su 12 si rompono."
  },
  {
    id: "sessione-esami",
    difficulty: "difficile",
    title: "La sessione d'esami",
    intro: "Mancano tre giorni all'esame: avete 22 ore di studio possibili e 8 unità di energia prima di crollare. Il metodo decide gli strumenti, gli strumenti decidono la vigilia.",
    resources: [
      {
        id: "ore",
        label: "Ore",
        unit: "ore",
        limit: 22
      },
      {
        id: "energia",
        label: "Energia",
        unit: "unità",
        limit: 8
      }
    ],
    goal: {
      label: "Preparazione",
      unit: "stelle"
    },
    steps: [
      "Che metodo?",
      "Con cosa studiate?",
      "La sera prima?"
    ],
    tree: [
      {
        id: "a",
        text: "Tutto da soli in biblioteca",
        use: {
          ore: 12,
          energia: 4
        },
        gain: 6,
        next: [
          {
            id: "aa",
            text: "Riassunti fatti a mano",
            use: {
              ore: 10,
              energia: 3
            },
            gain: 7,
            next: [
              {
                id: "aaa",
                text: "Ripasso fino alle tre",
                use: {
                  ore: 6,
                  energia: 4
                },
                gain: 8
              },
              {
                id: "aab",
                text: "Cena leggera e a letto presto",
                use: {
                  ore: 0,
                  energia: 0
                },
                gain: 4
              }
            ]
          },
          {
            id: "ab",
            text: "Quiz degli anni passati",
            use: {
              ore: 6,
              energia: 2
            },
            gain: 7,
            next: [
              {
                id: "aba",
                text: "Simulazione con un amico",
                use: {
                  ore: 4,
                  energia: 2
                },
                gain: 5
              },
              {
                id: "abb",
                text: "Ripasso fino alle tre",
                use: {
                  ore: 6,
                  energia: 4
                },
                gain: 8
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Gruppo di studio",
        use: {
          ore: 10,
          energia: 3
        },
        gain: 5,
        next: [
          {
            id: "ba",
            text: "Quiz degli anni passati",
            use: {
              ore: 6,
              energia: 2
            },
            gain: 7,
            next: [
              {
                id: "baa",
                text: "Ripasso fino alle tre",
                use: {
                  ore: 6,
                  energia: 4
                },
                gain: 8
              },
              {
                id: "bab",
                text: "Cena leggera e a letto presto",
                use: {
                  ore: 0,
                  energia: 0
                },
                gain: 4
              }
            ]
          },
          {
            id: "bb",
            text: "Mappe concettuali colorate",
            use: {
              ore: 8,
              energia: 2
            },
            gain: 7,
            next: [
              {
                id: "bba",
                text: "Simulazione con un amico",
                use: {
                  ore: 4,
                  energia: 2
                },
                gain: 5
              },
              {
                id: "bbb",
                text: "Cena leggera e a letto presto",
                use: {
                  ore: 0,
                  energia: 0
                },
                gain: 4
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Video lezioni a velocità doppia",
        use: {
          ore: 8,
          energia: 2
        },
        gain: 5,
        next: [
          {
            id: "ca",
            text: "Riassunti fatti a mano",
            use: {
              ore: 10,
              energia: 3
            },
            gain: 7,
            next: [
              {
                id: "caa",
                text: "Simulazione con un amico",
                use: {
                  ore: 4,
                  energia: 2
                },
                gain: 5
              },
              {
                id: "cab",
                text: "Ripasso fino alle tre",
                use: {
                  ore: 6,
                  energia: 4
                },
                gain: 8
              }
            ]
          },
          {
            id: "cb",
            text: "Mappe concettuali colorate",
            use: {
              ore: 8,
              energia: 2
            },
            gain: 7,
            next: [
              {
                id: "cba",
                text: "Ripasso fino alle tre",
                use: {
                  ore: 6,
                  energia: 4
                },
                gain: 8
              },
              {
                id: "cbb",
                text: "Cena leggera e a letto presto",
                use: {
                  ore: 0,
                  energia: 0
                },
                gain: 4
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "c",
        "cb",
        "cba"
      ]
    },
    explain: "Il percorso migliore è «Video lezioni a velocità doppia», «Mappe concettuali colorate», «Ripasso fino alle tre»: 20 stelle con 22 ore e 8 unità (limiti 22 ore e 8 unità). Partire da «Tutto da soli in biblioteca», la scelta più golosa, porta al massimo a 18 stelle. 4 percorsi su 12 si rompono."
  },
  {
    id: "vacanza-cinque-amici",
    difficulty: "difficile",
    title: "La vacanza in cinque",
    intro: "Cinque amici, 600 euro a testa e 10 giorni di ferie. La meta decide il viaggio, il viaggio decide quanto resta per l'esperienza da raccontare per anni.",
    resources: [
      {
        id: "euro",
        label: "Budget",
        unit: "€",
        limit: 600
      },
      {
        id: "giorni",
        label: "Ferie",
        unit: "giorni",
        limit: 10
      }
    ],
    goal: {
      label: "Racconti",
      unit: "stelle"
    },
    steps: [
      "Dove andate?",
      "Come ci arrivate?",
      "L'esperienza clou?"
    ],
    tree: [
      {
        id: "a",
        text: "Isola greca",
        use: {
          euro: 300,
          giorni: 7
        },
        gain: 9,
        next: [
          {
            id: "aa",
            text: "Traghetto notturno",
            use: {
              euro: 90,
              giorni: 2
            },
            gain: 6,
            next: [
              {
                id: "aaa",
                text: "Corso di immersioni",
                use: {
                  euro: 180,
                  giorni: 2
                },
                gain: 8
              },
              {
                id: "aab",
                text: "Giro dell'isola in scooter",
                use: {
                  euro: 60,
                  giorni: 1
                },
                gain: 6
              }
            ]
          },
          {
            id: "ab",
            text: "Volo diretto",
            use: {
              euro: 160,
              giorni: 0
            },
            gain: 6,
            next: [
              {
                id: "aba",
                text: "Gita in barca alle calette",
                use: {
                  euro: 90,
                  giorni: 1
                },
                gain: 7
              },
              {
                id: "abb",
                text: "Corso di immersioni",
                use: {
                  euro: 180,
                  giorni: 2
                },
                gain: 8
              }
            ]
          }
        ]
      },
      {
        id: "b",
        text: "Capitale del Nord Europa",
        use: {
          euro: 380,
          giorni: 5
        },
        gain: 8,
        next: [
          {
            id: "ba",
            text: "Volo diretto",
            use: {
              euro: 160,
              giorni: 0
            },
            gain: 6,
            next: [
              {
                id: "baa",
                text: "Concerto in un locale storico",
                use: {
                  euro: 70,
                  giorni: 1
                },
                gain: 7
              },
              {
                id: "bab",
                text: "Tour in bici dei quartieri",
                use: {
                  euro: 30,
                  giorni: 1
                },
                gain: 5
              }
            ]
          },
          {
            id: "bb",
            text: "Interrail",
            use: {
              euro: 120,
              giorni: 3
            },
            gain: 8,
            next: [
              {
                id: "bba",
                text: "Tour in bici dei quartieri",
                use: {
                  euro: 30,
                  giorni: 1
                },
                gain: 5
              },
              {
                id: "bbb",
                text: "Concerto in un locale storico",
                use: {
                  euro: 70,
                  giorni: 1
                },
                gain: 7
              }
            ]
          }
        ]
      },
      {
        id: "c",
        text: "Montagna in baita",
        use: {
          euro: 200,
          giorni: 6
        },
        gain: 7,
        next: [
          {
            id: "ca",
            text: "Auto in cinque",
            use: {
              euro: 60,
              giorni: 1
            },
            gain: 4,
            next: [
              {
                id: "caa",
                text: "Trekking di tre giorni in quota",
                use: {
                  euro: 120,
                  giorni: 3
                },
                gain: 8
              },
              {
                id: "cab",
                text: "Giornata alle terme",
                use: {
                  euro: 80,
                  giorni: 1
                },
                gain: 6
              }
            ]
          },
          {
            id: "cb",
            text: "Treno e corriera",
            use: {
              euro: 90,
              giorni: 2
            },
            gain: 6,
            next: [
              {
                id: "cba",
                text: "Giornata alle terme",
                use: {
                  euro: 80,
                  giorni: 1
                },
                gain: 6
              },
              {
                id: "cbb",
                text: "Trekking di tre giorni in quota",
                use: {
                  euro: 120,
                  giorni: 3
                },
                gain: 8
              }
            ]
          }
        ]
      }
    ],
    solution: {
      path: [
        "b",
        "bb",
        "bbb"
      ]
    },
    explain: "Il percorso migliore è «Capitale del Nord Europa», «Interrail», «Concerto in un locale storico»: 23 stelle con 570 € e 9 giorni (limiti 600 € e 10 giorni). Partire da «Isola greca», la scelta più golosa, porta al massimo a 22 stelle. 4 percorsi su 12 si rompono."
  }
];

export default varianti;

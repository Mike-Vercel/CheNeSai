import type { MetadataRoute } from "next";

/** Manifest dell'app installabile: "Aggiungi alla schermata Home" su telefoni (e TV con browser). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CHE NE SAI?!",
    short_name: "Che ne sai?!",
    description: "Il quiz show da giocare in compagnia: crea la partita dal PC collegato al TV, gli amici rispondono dal telefono.",
    lang: "it",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // scorciatoie (tenendo premuta l'icona dell'app installata)
    shortcuts: [
      { name: "Entra in partita", short_name: "Entra", description: "Scrivi il codice che vedi sul TV", url: "/entra", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Nuova partita", short_name: "Gioca", description: "Crea una partita dal PC", url: "/gioca", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}

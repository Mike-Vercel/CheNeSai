import type { MetadataRoute } from "next";

/** Manifest dell'app installabile: "Aggiungi alla schermata Home" su telefoni (e TV con browser). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CHE NE SAI?!",
    short_name: "Che ne sai?!",
    description: "Il game show quiz del venerdì sera: gioca dal tuo smartphone, guarda le domande sul TV del locale.",
    lang: "it",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#170824",
    theme_color: "#170824",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

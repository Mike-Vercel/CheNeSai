import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  // L'app è interamente dinamica (stato live): niente Cache Components.
  reactCompiler: true,
  poweredByHeader: false,
  // niente badge "N" di Next in sviluppo: copriva i tasti in basso a sinistra (Esci, GIRA). Gli errori restano visibili.
  devIndicators: false,
  // libreria iniziale e libreria ufficiale delle battute dei presentatori (importate dalla regia se mancano)
  outputFileTracingIncludes: { "/api/**": ["./content/show/battute.json", "./content/show/libreria-ufficiale.json"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/characters/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

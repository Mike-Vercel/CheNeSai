import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import { ServiceWorkerRegister } from "@/features/pwa/ServiceWorkerRegister";
import "./globals.css";

const lilita = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-lilita", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["500", "700", "800", "900"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CHE NE SAI?!", template: "%s · CHE NE SAI?!" },
  description: "Il quiz show da giocare in compagnia. Gioca dal tuo smartphone!",
  applicationName: "CHE NE SAI?!",
  icons: {
    icon: [
      { url: "/brand/icon.png", type: "image/png", sizes: "256x256" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Che ne sai?!", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#170824",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${lilita.variable} ${nunito.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

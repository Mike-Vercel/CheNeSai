import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

const lilita = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-lilita", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["500", "700", "800", "900"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CHE NE SAI?!", template: "%s · CHE NE SAI?!" },
  description: "Il game show quiz del venerdì sera. Gioca dal tuo smartphone!",
  applicationName: "CHE NE SAI?!",
  icons: { icon: "/brand/icon.png" },
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
      <body>{children}</body>
    </html>
  );
}

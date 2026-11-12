"use client";

import { clsx } from "clsx";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { inviteMessage, joinLink, shareInvite, whatsappUrl } from "./invite";

/** Indirizzo pubblico del sito (in sviluppo quello della pagina, così il link funziona in rete locale). */
export function publicBase(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env && !env.includes("localhost")) return env;
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Link per entrare nella partita (calcolato nel browser). */
export function useJoinUrl(code: string | null | undefined): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => setUrl(joinLink(publicBase(), code)), 0);
    return () => clearTimeout(t);
  }, [code]);
  return url;
}

function useQr(url: string): string | null {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#170824", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);
  return qr;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/**
 * «Invita amici»: condivisione del sistema (sul telefono apre WhatsApp, Telegram, SMS…) e, sempre a
 * portata di mano, le alternative: WhatsApp diretto, copia link, QR da far inquadrare.
 * `tone`: "phone" pulsante grande a tutta larghezza; "sheet" compatto (foglio impostazioni del TV).
 */
export function InviteButton({
  code,
  host,
  tone = "phone",
  className,
  online = false,
}: {
  code: string;
  host?: string | null;
  tone?: "phone" | "sheet";
  className?: string;
  /** partita ONLINE: il messaggio dice di entrare con il proprio account */
  online?: boolean;
}) {
  const joinUrl = useJoinUrl(code);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qr = useQr(showQr ? joinUrl : "");
  const message = joinUrl ? inviteMessage({ code, joinUrl, host, online }) : "";

  async function onInvite() {
    if (!joinUrl) return;
    const r = await shareInvite({ code, joinUrl, host, online });
    if (r === "unsupported") setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setShowQr(true);
    }
  }

  const big = tone === "phone";
  return (
    <div className={clsx("flex flex-col gap-2.5", className)}>
      <button
        type="button"
        onClick={() => void onInvite()}
        disabled={!joinUrl}
        className={clsx(
          "flex items-center justify-center gap-2.5 rounded-full font-display text-ink transition active:scale-[0.98] disabled:opacity-50",
          big ? "h-16 w-full bg-[#25d366] text-2xl shadow-[0_5px_0_#128c4a]" : "h-12 w-fit bg-[#25d366] px-6 text-xl shadow-[0_4px_0_#128c4a]",
        )}
      >
        <WhatsAppIcon /> INVITA AMICI
      </button>
      <div className={clsx("flex flex-wrap items-center gap-2", big && "justify-center")}>
        {!open && (
          <button type="button" className="rounded-full px-3 py-1.5 text-sm font-bold text-white/75 underline-offset-4 hover:text-white hover:underline" onClick={() => setOpen(true)}>
            Altri modi per invitare
          </button>
        )}
        {open && (
          <>
            <a
              href={message ? whatsappUrl(message) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
            >
              <WhatsAppIcon /> WhatsApp
            </a>
            <button type="button" className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20" onClick={() => void copy()}>
              {copied ? "✓ Link copiato" : "🔗 Copia link"}
            </button>
            <button type="button" aria-expanded={showQr} className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20" onClick={() => setShowQr((s) => !s)}>
              ▦ QR
            </button>
          </>
        )}
      </div>
      {open && showQr && (
        <div className={clsx("flex items-center gap-4 rounded-2xl bg-white/6 p-3", big && "justify-center")}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code per entrare nella partita ${code}`} width={150} height={150} className="h-[150px] w-[150px] rounded-xl bg-white p-1.5" />
          ) : (
            <div className="h-[150px] w-[150px] animate-pulse rounded-xl bg-white/10" />
          )}
          <p className="max-w-[12rem] text-sm font-bold text-white/80">
            Fallo inquadrare con la fotocamera.
            <span className="mt-1 block break-all text-white/60">{joinUrl.replace(/^https?:\/\//, "")}</span>
          </p>
        </div>
      )}
    </div>
  );
}

import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/account/AuthForm";
import { AuthShell } from "@/features/account/AuthShell";
import { safeNextPath } from "@/lib/auth/next-path";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Accedi o crea un account" };
export const viewport: Viewport = { themeColor: "#000000" };

const ERRORS: Record<string, string> = {
  google: "L'accesso con Google non è ancora attivo. Crea l'account con email e password: ci vuole un minuto.",
  "link-scaduto": "Il link è scaduto o è già stato usato. Accedi qui sotto o richiedine uno nuovo.",
  "altro-browser": "Apri il link dallo stesso browser con cui ti sei registrato, oppure accedi qui sotto.",
  annullato: "Accesso annullato.",
  accesso: "Accesso non riuscito, riprova.",
};

export default async function AccediPage({ searchParams }: { searchParams: Promise<{ next?: string; errore?: string; modo?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const host = await getHostUser().catch(() => null);
  // già collegato: si va avanti (lo username mancante si sceglie in /gioca)
  if (host && !sp.errore) redirect(next);
  return (
    <AuthShell>
      <AuthForm next={next} initialMode={sp.modo === "accedi" ? "login" : sp.modo === "password" ? "reset" : "signup"} error={sp.errore ? (ERRORS[sp.errore] ?? ERRORS.accesso) : null} />
    </AuthShell>
  );
}

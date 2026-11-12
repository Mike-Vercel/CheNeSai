"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Logo } from "@/features/game/components/brand";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export type AdminRole = "operator" | "admin" | "super_admin";
export interface AdminMe {
  userId: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

const RANK: Record<AdminRole, number> = { operator: 10, admin: 20, super_admin: 30 };
const MeCtx = createContext<AdminMe | null>(null);

export function useAdminMe(): AdminMe {
  const me = useContext(MeCtx);
  if (!me) throw new Error("useAdminMe fuori da AdminShell");
  return me;
}

/** Solo per nascondere comandi in UI: i permessi veri sono applicati dal backend. */
export function useCan(min: AdminRole): boolean {
  return RANK[useAdminMe().role] >= RANK[min];
}

const NAV: { href: string; label: string; icon: string; min: AdminRole }[] = [
  { href: "/admin", label: "Dashboard", icon: "🏠", min: "operator" },
  { href: "/admin/sessions", label: "Serate", icon: "🎬", min: "operator" },
  { href: "/admin/questions", label: "Domande", icon: "❓", min: "admin" },
  { href: "/admin/media", label: "Media", icon: "🎵", min: "admin" },
  { href: "/admin/events", label: "Eventi Palmino", icon: "🌴", min: "admin" },
  { href: "/admin/voices", label: "Voci", icon: "🎙️", min: "admin" },
  { href: "/admin/presentatori", label: "Presentatori", icon: "🎭", min: "admin" },
  { href: "/admin/psyco", label: "PSYCO · Regole", icon: "🔎", min: "admin" },
  { href: "/admin/leaderboards", label: "Classifiche", icon: "🏆", min: "admin" },
  { href: "/admin/stats", label: "Statistiche", icon: "📊", min: "admin" },
  { href: "/admin/settings", label: "Impostazioni", icon: "⚙️", min: "admin" },
  { href: "/admin/audit", label: "Registro attività", icon: "📜", min: "admin" },
];

const ROLE_LABEL: Record<AdminRole, string> = { operator: "Operatore", admin: "Admin", super_admin: "Super Admin" };

export function AdminShell({ me, children }: { me: AdminMe; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // La regia live usa tutto lo schermo
  const fullscreen = /^\/admin\/sessions\/[^/]+\/(live|rehearsal)/.test(path);

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const nav = NAV.filter((n) => RANK[me.role] >= RANK[n.min]);
  return (
    <MeCtx.Provider value={me}>
      {fullscreen ? (
        children
      ) : (
        <div className="flex min-h-dvh">
          <aside
            className={clsx(
              "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-[#0d0418] p-4 transition-transform md:static md:translate-x-0",
              open ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <Link href="/admin" className="mb-6 flex justify-center" onClick={() => setOpen(false)}>
              <Logo size="sm" />
            </Link>
            <nav className="flex flex-1 flex-col gap-1">
              {nav.map((n) => {
                const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-3 py-2 font-bold transition",
                      active ? "bg-gold text-ink" : "text-white/80 hover:bg-white/10",
                    )}
                  >
                    <span aria-hidden>{n.icon}</span>
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm">
              <p className="truncate font-bold">{me.displayName}</p>
              <p className="truncate text-white/50">{me.email}</p>
              <p className="mt-1 text-xs font-bold text-gold">{ROLE_LABEL[me.role]}</p>
              <button onClick={logout} className="mt-2 text-xs font-bold text-white/60 underline hover:text-white">
                Esci
              </button>
            </div>
          </aside>
          {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />}
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#120620]/90 px-4 py-3 backdrop-blur md:hidden">
              <button onClick={() => setOpen(true)} className="rounded-lg bg-white/10 px-3 py-1 font-bold" aria-label="Apri menu">
                ☰
              </button>
              <span className="font-display text-gold">CHE NE SAI?! · Regia</span>
            </header>
            <main className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</main>
          </div>
        </div>
      )}
    </MeCtx.Provider>
  );
}

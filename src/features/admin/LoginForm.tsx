"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { Character, Logo } from "@/features/game/components/brand";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await getSupabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setLoading(false);
      setError(err.message === "Invalid login credentials" ? "Email o password non corretti" : err.message);
      return;
    }
    const me = await fetch("/api/admin/me", { cache: "no-store" });
    if (!me.ok) {
      await getSupabaseBrowser().auth.signOut();
      setLoading(false);
      setError("Questo account non è abilitato alla regia");
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/admin") ? next : "/admin");
    router.refresh();
  }

  return (
    <div className="relative w-full max-w-md">
      <Character who="professore" small className="pointer-events-none absolute -left-40 bottom-0 hidden w-56 md:block" />
      <form onSubmit={submit} className="qz-panel relative z-10 flex flex-col gap-4 rounded-3xl p-6">
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>
        <h1 className="text-center font-display text-2xl text-white">Accesso regia</h1>
        <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        {error && <p className="rounded-xl bg-flame/20 px-3 py-2 text-sm font-bold text-[#ffc2cd]">{error}</p>}
        <Button type="submit" variant="gold" size="lg" loading={loading}>
          ENTRA IN REGIA
        </Button>
      </form>
    </div>
  );
}

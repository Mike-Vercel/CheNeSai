import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Esci dall'account (form POST): chiude la sessione e torna alla home. */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/", new URL(req.url).origin), { status: 303 });
}

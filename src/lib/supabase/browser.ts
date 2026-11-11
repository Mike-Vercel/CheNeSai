"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_COOKIE_NAME, browserSupabaseUrl } from "./shared";

let client: SupabaseClient | null = null;

/** Client browser: usato SOLO per Realtime (canale pubblico) e login admin. */
export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(browserSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      realtime: { params: { eventsPerSecond: 20 }, heartbeatIntervalMs: 15000 },
      cookieOptions: { name: AUTH_COOKIE_NAME },
    });
  }
  return client;
}

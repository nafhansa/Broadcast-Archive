import { createClient } from "@supabase/supabase-js";
import type { Db } from "./admin";
import { clientEnv } from "@/lib/env";

// Klien anon tanpa cookies: halaman publik tetap bisa di-cache/ISR.
export function supabasePublic(): Db {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

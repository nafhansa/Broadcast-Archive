import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Tanpa tipe skema yang digenerate: baris diperlakukan sebagai any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, "public", any>;
import { serverEnv } from "@/lib/env.server";

let client: Db | null = null;

export function supabaseAdmin(): Db {
  client ??= createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

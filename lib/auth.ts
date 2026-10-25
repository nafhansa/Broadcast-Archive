import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function requireAdmin() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/admin-login");
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) redirect("/admin-login");
  return data.user;
}

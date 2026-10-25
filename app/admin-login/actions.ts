"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginState = { error?: string } | undefined;

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = Schema.safeParse({ email: form.get("email"), password: form.get("password") });
  const generic = { error: "Email atau password salah." };
  if (!parsed.success) return generic;

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) {
    await new Promise((r) => setTimeout(r, 800));
    return generic;
  }
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) {
    await sb.auth.signOut();
    return { error: "Akun ini bukan admin." };
  }
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

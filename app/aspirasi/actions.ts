"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { sha256 } from "@/lib/hash";
import { normalizeAspiration } from "@/lib/aspirasi/normalize";
import { isFlagged } from "@/lib/moderation";

export type ActionResult = { ok: true } | { ok: false; error: string };

const Input = z.object({
  slug: z.string().min(1).max(80),
  text: z.string().trim().min(2, "Terlalu pendek").max(280),
});

export async function submitAspiration(slug: string, text: string, honeypot: string): Promise<ActionResult> {
  // Bot mengisi field tersembunyi: balas sukses tanpa menyimpan, tanpa memberi sinyal
  if (honeypot) return { ok: true };
  const parsed = Input.safeParse({ slug, text });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  const clean = parsed.data.text;

  const db = supabaseAdmin();
  const { data: pojok } = await db
    .from("pojok")
    .select("id,max_length,is_open,is_visible")
    .eq("slug", slug)
    .maybeSingle();
  if (!pojok || !pojok.is_visible) return { ok: false, error: "Pojok tidak ditemukan." };
  if (!pojok.is_open) return { ok: false, error: "Pojok ini sudah ditutup." };
  if (clean.length > pojok.max_length) return { ok: false, error: `Maksimal ${pojok.max_length} karakter.` };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const ipHash = await sha256(serverEnv.IP_HASH_SALT + ip + pojok.id);

  const now = Date.now();
  const [{ count: c10m }, { count: c10s }] = await Promise.all([
    db.from("aspirations").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(now - 600_000).toISOString()),
    db.from("aspirations").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(now - 10_000).toISOString()),
  ]);
  if ((c10m ?? 0) >= 5 || (c10s ?? 0) >= 1) return { ok: false, error: "Terlalu cepat, coba lagi sebentar." };

  const normalized = normalizeAspiration(clean);
  if (!normalized) return { ok: false, error: "Teks tidak valid." };

  const flagged = isFlagged(clean);
  const { error } = await db.from("aspirations").insert({
    pojok_id: pojok.id,
    text: clean,
    normalized,
    status: flagged ? "hidden" : "visible",
    auto_flagged: flagged,
    ip_hash: ipHash,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Kamu sudah mengirim jawaban ini." };
    console.error("submitAspiration", error);
    return { ok: false, error: "Gagal mengirim, coba lagi." };
  }
  revalidatePath(`/aspirasi/${slug}`);
  return { ok: true };
}

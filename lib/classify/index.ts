import "server-only";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";
import { categoryOf } from "@/lib/categories";
import { editMessageText } from "@/lib/telegram/api";
import { categoryKeyboard } from "@/lib/telegram/keyboard";
import { makeTitleFallback } from "@/lib/telegram/parse";
import { classifyWithAI, OpenRouterError } from "./openrouter";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function askAI(body: string, group: string | null) {
  try {
    return await classifyWithAI(body, group);
  } catch (e) {
    if (e instanceof OpenRouterError && (e.status === 429 || e.status >= 500)) {
      await sleep(3000);
      return await classifyWithAI(body, group);
    }
    throw e;
  }
}

export async function classifyAndUpdate(broadcastId: string, opts: { force?: boolean } = {}) {
  const db = supabaseAdmin();
  const { data: b } = await db.from("broadcasts").select("*").eq("id", broadcastId).maybeSingle();
  if (!b) return { ok: false as const, error: "Broadcast tidak ditemukan" };

  let ok = false;
  try {
    const ai = await askAI(b.body as string, (b.source_group as string | null) ?? null);
    // Baca ulang: owner mungkin menekan tombol kategori saat AI berjalan
    const { data: fresh } = await db.from("broadcasts").select("category_source").eq("id", broadcastId).single();
    const manual = fresh?.category_source === "manual" && !opts.force;
    const fallbackTitle = (b.title as string) === makeTitleFallback(b.body as string);

    const patch: Record<string, unknown> = { ai_model: ai.model, ai_confidence: ai.confidence };
    if (!manual) {
      patch.category = ai.category;
      patch.category_source = "ai";
    }
    if (!manual || fallbackTitle) patch.title = ai.title;
    if (ai.deadline && (!manual || !b.deadline)) patch.deadline = ai.deadline;

    await db.from("broadcasts").update(patch).eq("id", broadcastId);
    ok = true;
  } catch (e) {
    console.error("classify failed", e);
  }

  await refreshConfirmation(broadcastId);
  revalidatePath("/");
  revalidatePath(`/b/${broadcastId}`);
  return ok ? { ok: true as const } : { ok: false as const, error: "Klasifikasi AI gagal, memakai hasil aturan" };
}

export async function refreshConfirmation(broadcastId: string) {
  const db = supabaseAdmin();
  const { data: b } = await db
    .from("broadcasts")
    .select("title,category,tg_chat_id,tg_confirm_message_id")
    .eq("id", broadcastId)
    .maybeSingle();
  if (!b?.tg_chat_id || !b.tg_confirm_message_id) return;
  const text = `Tersimpan\n${b.title}\nKategori: ${categoryOf(b.category as string).label}\n${clientEnv.NEXT_PUBLIC_SITE_URL}/b/${broadcastId}`;
  await editMessageText(
    Number(b.tg_chat_id),
    Number(b.tg_confirm_message_id),
    text,
    categoryKeyboard(broadcastId, b.category as string),
  );
}

import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { serverEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createBroadcastFromMessage, type TgMessage } from "@/lib/ingest";
import { classifyAndUpdate, refreshConfirmation } from "@/lib/classify";
import { answerCallbackQuery, editMessageReplyMarkup, editMessageText, sendMessage } from "@/lib/telegram/api";
import { categoryKeyboard, unhideKeyboard } from "@/lib/telegram/keyboard";
import { CATEGORY_KEYS, categoryOf, type CategoryKey } from "@/lib/categories";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type CallbackQuery = {
  id: string;
  from: { id: number };
  data?: string;
  message?: { message_id: number; chat: { id: number } };
};

export async function POST(req: Request) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== serverEnv.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const update = await req.json().catch(() => null);
  if (!update?.update_id) return NextResponse.json({ ok: true });

  const db = supabaseAdmin();
  // Idempotensi: Telegram bisa mengirim ulang update yang sama
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? 0;
  const { error: dupErr } = await db.from("tg_updates").insert({
    update_id: update.update_id,
    chat_id: chatId,
    message_id: update.message?.message_id ?? null,
    text_len: (update.message?.text ?? update.message?.caption ?? "").length,
  });
  if (dupErr?.code === "23505") return NextResponse.json({ ok: true });

  try {
    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message) await handleMessage(update.message, update.update_id);
  } catch (e) {
    console.error("telegram handler", e);
  }
  return NextResponse.json({ ok: true }); // SELALU 200
}

const isOwner = (id?: number) => id === serverEnv.TELEGRAM_OWNER_ID;
const site = serverEnv.NEXT_PUBLIC_SITE_URL;

async function handleMessage(msg: TgMessage, updateId: number) {
  if (msg.chat.type !== "private") return;
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  const cmd = text.startsWith("/") ? text.split(/[\s@]/)[0].toLowerCase() : null;

  if (cmd === "/start") {
    await sendMessage(chatId, `ID Telegram kamu: ${msg.from?.id}. Status: ${isOwner(msg.from?.id) ? "owner" : "bukan owner"}.`);
    return;
  }
  if (!isOwner(msg.from?.id)) {
    await sendMessage(chatId, "Bot ini privat.");
    return;
  }

  const db = supabaseAdmin();
  if (cmd === "/undo") {
    const { data: b } = await db
      .from("broadcasts")
      .select("id,title")
      .eq("tg_chat_id", chatId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!b) {
      await sendMessage(chatId, "Tidak ada broadcast untuk disembunyikan.");
      return;
    }
    await db.from("broadcasts").update({ status: "hidden" }).eq("id", b.id);
    revalidatePath("/");
    revalidatePath(`/b/${b.id}`);
    await sendMessage(chatId, `Disembunyikan: ${b.title}`);
    return;
  }
  if (cmd === "/last") {
    const { data } = await db
      .from("broadcasts")
      .select("id,title,category")
      .order("created_at", { ascending: false })
      .limit(5);
    const lines = (data ?? []).map((b, i) => `${i + 1}. ${b.title}\n   ${categoryOf(b.category).label} | ${site}/b/${b.id}`);
    await sendMessage(chatId, lines.length ? lines.join("\n") : "Belum ada broadcast.");
    return;
  }
  if (cmd === "/help") {
    await sendMessage(
      chatId,
      [
        "Share atau tempel broadcast ke chat ini untuk menyimpannya.",
        "Opsional, baris pertama: #Nama Grup | Nama Pengirim",
        "",
        "/last  5 broadcast terakhir",
        "/undo  sembunyikan broadcast terakhir",
        "/help  bantuan ini",
      ].join("\n"),
    );
    return;
  }

  const result = await createBroadcastFromMessage(msg, updateId);
  if (result.kind === "empty") {
    await sendMessage(chatId, "Tidak ada teks untuk disimpan.");
    return;
  }
  if (result.kind === "duplicate") {
    await sendMessage(chatId, `Sudah ada di arsip: ${site}/b/${result.id}`);
    return;
  }
  if (result.kind === "merged") {
    revalidatePath("/");
    revalidatePath(`/b/${result.id}`);
    after(() => classifyAndUpdate(result.id));
    return;
  }

  const sent = await sendMessage(
    chatId,
    `Tersimpan\n${result.title}\nKategori: ${categoryOf(result.category).label} (sementara, menunggu klasifikasi)\n${site}/b/${result.id}`,
    categoryKeyboard(result.id, result.category),
  );
  if (sent?.message_id) {
    await db.from("broadcasts").update({ tg_confirm_message_id: sent.message_id }).eq("id", result.id);
  }
  revalidatePath("/");
  after(() => classifyAndUpdate(result.id));
}

async function handleCallback(cq: CallbackQuery) {
  if (!isOwner(cq.from.id)) {
    await answerCallbackQuery(cq.id, "Bukan owner");
    return;
  }
  const [action, id, value] = (cq.data ?? "").split(":");
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;
  if (!id || !chatId || !messageId) {
    await answerCallbackQuery(cq.id);
    return;
  }
  const db = supabaseAdmin();

  if (action === "c" && CATEGORY_KEYS.includes(value as CategoryKey)) {
    await db.from("broadcasts").update({ category: value, category_source: "manual" }).eq("id", id);
    await editMessageReplyMarkup(chatId, messageId, categoryKeyboard(id, value));
    await refreshConfirmation(id);
    await answerCallbackQuery(cq.id, `Kategori: ${categoryOf(value).label}`);
  } else if (action === "h") {
    await db.from("broadcasts").update({ status: "hidden" }).eq("id", id);
    await editMessageText(chatId, messageId, "Disembunyikan", unhideKeyboard(id));
    await answerCallbackQuery(cq.id, "Disembunyikan");
  } else if (action === "u") {
    await db.from("broadcasts").update({ status: "published" }).eq("id", id);
    await refreshConfirmation(id);
    await answerCallbackQuery(cq.id, "Ditampilkan");
  } else {
    await answerCallbackQuery(cq.id);
    return;
  }
  revalidatePath("/");
  revalidatePath(`/b/${id}`);
}

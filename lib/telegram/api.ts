import "server-only";
import { serverEnv } from "@/lib/env.server";

export type InlineKeyboard = {
  inline_keyboard: { text: string; callback_data?: string; url?: string }[][];
};

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`https://api.telegram.org/bot${serverEnv.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!json?.ok) {
    console.error(`telegram ${method} failed`, json?.description ?? res.status);
    return null;
  }
  return json.result ?? null;
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: InlineKeyboard) {
  return call<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  });
}

export async function editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: InlineKeyboard) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  });
}

export async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup: InlineKeyboard) {
  return call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup });
}

export async function answerCallbackQuery(id: string, text?: string) {
  return call("answerCallbackQuery", { callback_query_id: id, text });
}

export async function getFile(fileId: string) {
  return call<{ file_id: string; file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
}

export async function downloadFile(filePath: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://api.telegram.org/file/bot${serverEnv.TELEGRAM_BOT_TOKEN}/${filePath}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`telegram download ${res.status}`);
  return res.arrayBuffer();
}

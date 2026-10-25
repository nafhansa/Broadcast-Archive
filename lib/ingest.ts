import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { contentHash } from "@/lib/hash";
import { classifyByRules, extractDeadline, todayJakarta } from "@/lib/classify/rules";
import { downloadFile, getFile } from "@/lib/telegram/api";
import { extractLinks, makeTitleFallback, parseHeader, type TgEntity } from "@/lib/telegram/parse";

export type TgMessage = {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
  from?: { id: number };
  text?: string;
  caption?: string;
  entities?: TgEntity[];
  caption_entities?: TgEntity[];
  photo?: { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }[];
  document?: { file_id: string; file_unique_id: string; mime_type?: string; file_size?: number };
};

export type IngestResult =
  | { kind: "empty" }
  | { kind: "duplicate"; id: string }
  | { kind: "merged"; id: string }
  | { kind: "created"; id: string; title: string; category: string };

type MediaItem = { path: string; url: string; width?: number; height?: number; mime: string };

const MAX_FILE = 20 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };

async function uploadMedia(broadcastId: string, msg: TgMessage): Promise<MediaItem[]> {
  const db = supabaseAdmin();
  let target: { fileId: string; uniqueId: string; mime: string; width?: number; height?: number } | null = null;

  if (msg.photo?.length) {
    const p = [...msg.photo].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    target = { fileId: p.file_id, uniqueId: p.file_unique_id, mime: "image/jpeg", width: p.width, height: p.height };
  } else if (msg.document) {
    const d = msg.document;
    const mime = d.mime_type ?? "";
    if ((mime.startsWith("image/") || mime === "application/pdf") && (d.file_size ?? 0) <= MAX_FILE) {
      target = { fileId: d.file_id, uniqueId: d.file_unique_id, mime };
    }
  }
  if (!target) return [];

  try {
    const file = await getFile(target.fileId);
    if (!file?.file_path) return [];
    const buf = await downloadFile(file.file_path);
    if (buf.byteLength > MAX_FILE) return [];
    const ext = EXT[target.mime] ?? file.file_path.split(".").pop() ?? "bin";
    const path = `broadcasts/${broadcastId}/${target.uniqueId}.${ext}`;
    const { error } = await db.storage.from("broadcast-media").upload(path, buf, { contentType: target.mime, upsert: true });
    if (error) throw error;
    const { data } = db.storage.from("broadcast-media").getPublicUrl(path);
    return [{ path, url: data.publicUrl, width: target.width, height: target.height, mime: target.mime }];
  } catch (e) {
    console.error("media upload failed", e);
    return [];
  }
}

export async function createBroadcastFromMessage(msg: TgMessage, updateId: number): Promise<IngestResult> {
  const db = supabaseAdmin();
  const raw = msg.text ?? msg.caption ?? "";
  const entities = msg.entities ?? msg.caption_entities ?? [];
  const hasMedia = !!(msg.photo?.length || msg.document);
  if (!raw.trim() && !hasMedia) return { kind: "empty" };

  // Gabung pesan terpecah (Telegram memecah teks > 4096 karakter)
  const since = new Date(Date.now() - 20_000).toISOString();
  const { data: prev } = await db
    .from("tg_updates")
    .select("broadcast_id")
    .eq("chat_id", msg.chat.id)
    .neq("update_id", updateId)
    .gte("created_at", since)
    .gte("text_len", 3500)
    .not("broadcast_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev?.broadcast_id && raw) {
    const { data: b } = await db.from("broadcasts").select("*").eq("id", prev.broadcast_id).single();
    if (b) {
      const body = `${b.body}\n${raw}`;
      const links = extractLinks(body, []);
      const { error } = await db
        .from("broadcasts")
        .update({
          body,
          links,
          content_hash: await contentHash(body),
          tg_message_ids: [...(b.tg_message_ids ?? []), msg.message_id],
        })
        .eq("id", b.id);
      if (!error) {
        await db.from("tg_updates").update({ broadcast_id: b.id }).eq("update_id", updateId);
        return { kind: "merged", id: b.id };
      }
    }
  }

  const { group, sender, body: parsedBody } = parseHeader(raw);
  const body = parsedBody || "(lampiran tanpa teks)";
  const hash = await contentHash(body);
  const links = extractLinks(raw, entities);
  const title = makeTitleFallback(body);
  const category = classifyByRules(title, body);
  const deadline = extractDeadline(body, todayJakarta());
  const id = crypto.randomUUID();

  const { data: inserted, error } = await db
    .from("broadcasts")
    .upsert(
      {
        id, title, body, category, category_source: "rule", links, source_group: group, sender, deadline,
        content_hash: hash, tg_chat_id: msg.chat.id, tg_message_ids: [msg.message_id],
        received_at: new Date().toISOString(),
      },
      { onConflict: "content_hash", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw error;

  if (!inserted?.length) {
    const { data: existing } = await db.from("broadcasts").select("id").eq("content_hash", hash).single();
    return { kind: "duplicate", id: existing!.id };
  }

  const media = await uploadMedia(id, msg);
  if (media.length) await db.from("broadcasts").update({ media }).eq("id", id);
  await db.from("tg_updates").update({ broadcast_id: id }).eq("update_id", updateId);
  return { kind: "created", id, title, category };
}

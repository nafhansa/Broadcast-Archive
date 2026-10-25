"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { CATEGORY_KEYS } from "@/lib/categories";
import { classifyAndUpdate } from "@/lib/classify";
import { extractLinks } from "@/lib/telegram/parse";
import { contentHash } from "@/lib/hash";

export type Result = { ok: true } | { ok: false; error: string };

const uuid = z.string().uuid();
const uuids = z.array(uuid).min(1).max(500);
const category = z.enum(CATEGORY_KEYS);
const fail = (e: unknown): Result => {
  console.error("admin action", e);
  return { ok: false, error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Input tidak valid") : "Terjadi kesalahan." };
};

function revalidateBroadcasts(ids: string[] = []) {
  revalidatePath("/");
  revalidatePath("/admin/broadcasts");
  for (const id of ids) {
    revalidatePath(`/b/${id}`);
    revalidatePath(`/admin/broadcasts/${id}`);
  }
}

const LinkSchema = z.object({
  url: z.string().url().refine((u) => /^https?:\/\//i.test(u), "Hanya http/https"),
  label: z.string().trim().min(1).max(60),
  kind: z.string().default("web"),
});

const BroadcastUpdate = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi").max(200),
  body: z.string().trim().min(1, "Isi wajib diisi"),
  category,
  source_group: z.string().trim().max(120).nullable(),
  sender: z.string().trim().max(120).nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(["published", "hidden"]),
  pinned: z.boolean(),
  links: z.array(LinkSchema).max(12),
  media: z.array(z.object({ path: z.string(), url: z.string(), mime: z.string(), width: z.number().optional(), height: z.number().optional() })),
});
export type BroadcastUpdateInput = z.infer<typeof BroadcastUpdate>;

export async function updateBroadcast(id: string, data: BroadcastUpdateInput): Promise<Result> {
  await requireAdmin();
  try {
    const input = BroadcastUpdate.parse(data);
    uuid.parse(id);
    const db = supabaseAdmin();
    const { data: cur } = await db.from("broadcasts").select("category,media").eq("id", id).single();
    if (!cur) return { ok: false, error: "Broadcast tidak ditemukan" };

    const patch: Record<string, unknown> = {
      ...input,
      source_group: input.source_group || null,
      sender: input.sender || null,
      content_hash: await contentHash(input.body),
    };
    if (cur.category !== input.category) patch.category_source = "manual";

    const kept = new Set(input.media.map((m) => m.path));
    const removed = ((cur.media ?? []) as { path: string }[]).map((m) => m.path).filter((p) => !kept.has(p));
    const { error } = await db.from("broadcasts").update(patch).eq("id", id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Isi yang sama sudah ada di broadcast lain" };
      throw error;
    }
    if (removed.length) await db.storage.from("broadcast-media").remove(removed);
    revalidateBroadcasts([id]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setBroadcastStatus(ids: string[], status: "published" | "hidden"): Promise<Result> {
  await requireAdmin();
  try {
    uuids.parse(ids);
    z.enum(["published", "hidden"]).parse(status);
    const { error } = await supabaseAdmin().from("broadcasts").update({ status }).in("id", ids);
    if (error) throw error;
    revalidateBroadcasts(ids);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setBroadcastCategory(ids: string[], cat: string): Promise<Result> {
  await requireAdmin();
  try {
    uuids.parse(ids);
    const c = category.parse(cat);
    const { error } = await supabaseAdmin().from("broadcasts").update({ category: c, category_source: "manual" }).in("id", ids);
    if (error) throw error;
    revalidateBroadcasts(ids);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleBroadcastPin(id: string, pinned: boolean): Promise<Result> {
  await requireAdmin();
  try {
    uuid.parse(id);
    const { error } = await supabaseAdmin().from("broadcasts").update({ pinned: !!pinned }).eq("id", id);
    if (error) throw error;
    revalidateBroadcasts([id]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBroadcasts(ids: string[]): Promise<Result> {
  await requireAdmin();
  try {
    uuids.parse(ids);
    const db = supabaseAdmin();
    const { data } = await db.from("broadcasts").select("media").in("id", ids);
    const paths = (data ?? []).flatMap((r) => ((r.media ?? []) as { path: string }[]).map((m) => m.path));
    const { error } = await db.from("broadcasts").delete().in("id", ids);
    if (error) throw error;
    if (paths.length) await db.storage.from("broadcast-media").remove(paths);
    revalidateBroadcasts(ids);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reclassifyBroadcast(id: string): Promise<Result> {
  await requireAdmin();
  try {
    uuid.parse(id);
    const r = await classifyAndUpdate(id, { force: true });
    revalidateBroadcasts([id]);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch (e) {
    return fail(e);
  }
}

export async function reextractLinks(id: string): Promise<Result & { links?: unknown[] }> {
  await requireAdmin();
  try {
    uuid.parse(id);
    const { data } = await supabaseAdmin().from("broadcasts").select("body").eq("id", id).single();
    if (!data) return { ok: false, error: "Broadcast tidak ditemukan" };
    return { ok: true, links: extractLinks(data.body) };
  } catch (e) {
    return fail(e);
  }
}

const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PojokInput = z.object({
  slug: z.string().regex(slugRe, "Slug hanya huruf kecil, angka, dan tanda hubung").max(60),
  title: z.string().trim().min(1, "Judul wajib diisi").max(120),
  question: z.string().trim().min(1, "Pertanyaan wajib diisi").max(300),
  description: z.string().trim().max(600).nullable(),
  max_length: z.number().int().min(10).max(280),
  is_open: z.boolean(),
  is_visible: z.boolean(),
  sort_order: z.number().int().min(-1000).max(1000),
});
export type PojokInputT = z.infer<typeof PojokInput>;

function revalidatePojok(slug?: string) {
  revalidatePath("/aspirasi");
  revalidatePath("/admin/aspirasi");
  if (slug) revalidatePath(`/aspirasi/${slug}`);
}

export async function createPojok(data: Partial<PojokInputT>): Promise<Result> {
  await requireAdmin();
  try {
    const input = PojokInput.parse({ description: null, is_open: true, is_visible: true, sort_order: 0, max_length: 80, ...data });
    const { error } = await supabaseAdmin().from("pojok").insert({ ...input, description: input.description || null });
    if (error) return error.code === "23505" ? { ok: false, error: "Slug sudah dipakai" } : fail(error);
    revalidatePojok(input.slug);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePojok(id: string, data: Partial<PojokInputT>): Promise<Result> {
  await requireAdmin();
  try {
    uuid.parse(id);
    const input = PojokInput.partial().parse(data);
    const { data: row, error } = await supabaseAdmin()
      .from("pojok")
      .update({ ...input, ...(input.description !== undefined ? { description: input.description || null } : {}) })
      .eq("id", id)
      .select("slug")
      .single();
    if (error) return error.code === "23505" ? { ok: false, error: "Slug sudah dipakai" } : fail(error);
    revalidatePojok(row?.slug);
    revalidatePath(`/admin/aspirasi/${id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePojok(id: string): Promise<Result> {
  await requireAdmin();
  try {
    uuid.parse(id);
    const { data: row } = await supabaseAdmin().from("pojok").select("slug").eq("id", id).maybeSingle();
    const { error } = await supabaseAdmin().from("pojok").delete().eq("id", id);
    if (error) throw error;
    revalidatePojok(row?.slug);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

async function revalidateAspirationPojok(ids: string[]) {
  const { data } = await supabaseAdmin().from("aspirations").select("pojok_id").in("id", ids);
  const pojokIds = [...new Set((data ?? []).map((r) => r.pojok_id as string))];
  const { data: rows } = await supabaseAdmin().from("pojok").select("id,slug").in("id", pojokIds.length ? pojokIds : ["00000000-0000-0000-0000-000000000000"]);
  for (const r of rows ?? []) {
    revalidatePath(`/aspirasi/${r.slug}`);
    revalidatePath(`/admin/aspirasi/${r.id}`);
  }
}

export async function setAspirationStatus(ids: string[], status: "visible" | "hidden"): Promise<Result> {
  await requireAdmin();
  try {
    uuids.parse(ids);
    z.enum(["visible", "hidden"]).parse(status);
    const { error } = await supabaseAdmin()
      .from("aspirations")
      .update({ status, ...(status === "visible" ? { auto_flagged: false } : {}) })
      .in("id", ids);
    if (error) throw error;
    await revalidateAspirationPojok(ids);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAspirations(ids: string[]): Promise<Result> {
  await requireAdmin();
  try {
    uuids.parse(ids);
    await revalidateAspirationPojok(ids);
    const { error } = await supabaseAdmin().from("aspirations").delete().in("id", ids);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function hideAspirationsBySameSender(aspirationId: string): Promise<Result> {
  await requireAdmin();
  try {
    uuid.parse(aspirationId);
    const db = supabaseAdmin();
    const { data: a } = await db.from("aspirations").select("pojok_id,ip_hash").eq("id", aspirationId).single();
    if (!a) return { ok: false, error: "Aspirasi tidak ditemukan" };
    const { error } = await db.from("aspirations").update({ status: "hidden" }).eq("pojok_id", a.pojok_id).eq("ip_hash", a.ip_hash);
    if (error) throw error;
    await revalidateAspirationPojok([aspirationId]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signOut(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/admin-login");
}

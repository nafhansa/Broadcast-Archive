import { supabasePublic } from "@/lib/supabase/public";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { Broadcast, CloudEntry, FeedParams, Pojok } from "@/lib/types";

export const PAGE_SIZE = 20;

export type FeedPage = { items: Broadcast[]; nextCursor: string | null };

function validCat(cat?: string) {
  return cat && (CATEGORY_KEYS as string[]).includes(cat) ? cat : undefined;
}

export function parseCursor(cursor?: string): { ts: string; id: string } | null {
  if (!cursor) return null;
  const i = cursor.lastIndexOf("_");
  if (i < 1) return null;
  const ts = cursor.slice(0, i);
  const id = cursor.slice(i + 1);
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(ts) || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return { ts, id };
}

export async function listBroadcasts(params: FeedParams, cursor?: string): Promise<FeedPage> {
  const sb = supabasePublic();
  const cat = validCat(params.cat);
  const q = params.q?.trim().slice(0, 100);
  const cur = parseCursor(cursor);
  const showPinnedFirst = !cat && !q;

  const build = (mode: "fts" | "ilike" | "none") => {
    let query = sb.from("broadcasts").select("*").eq("status", "published");
    if (cat) query = query.eq("category", cat);
    if (showPinnedFirst) query = query.eq("pinned", false);
    if (q && mode === "fts") query = query.textSearch("search", q, { type: "websearch", config: "simple" });
    if (q && mode === "ilike") query = query.ilike("body", `%${q.replace(/[%_,()]/g, " ")}%`);
    if (cur) query = query.or(`received_at.lt.${cur.ts},and(received_at.eq.${cur.ts},id.lt.${cur.id})`);
    return query.order("received_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
  };

  let { data } = await build(q ? "fts" : "none");
  if (q && q.length >= 3 && !data?.length) ({ data } = await build("ilike"));

  let rows = (data ?? []) as Broadcast[];
  const hasMore = rows.length > PAGE_SIZE;
  rows = rows.slice(0, PAGE_SIZE);

  if (showPinnedFirst && !cur) {
    const { data: pinned } = await sb
      .from("broadcasts")
      .select("*")
      .eq("status", "published")
      .eq("pinned", true)
      .order("received_at", { ascending: false });
    rows = [...((pinned ?? []) as Broadcast[]), ...rows];
  }
  const last = rows.filter((r) => !(showPinnedFirst && r.pinned)).at(-1);
  return { items: rows, nextCursor: hasMore && last ? `${last.received_at}_${last.id}` : null };
}

export async function categoryCounts(): Promise<Record<string, number>> {
  const { data } = await supabasePublic().from("broadcasts").select("category").eq("status", "published").limit(10000);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.category] = (out[r.category] ?? 0) + 1;
  return out;
}

export async function upcomingDeadlines(today: string): Promise<Pick<Broadcast, "id" | "title" | "deadline">[]> {
  const { data } = await supabasePublic()
    .from("broadcasts")
    .select("id,title,deadline")
    .eq("status", "published")
    .gte("deadline", today)
    .order("deadline", { ascending: true })
    .limit(6);
  return (data ?? []) as Pick<Broadcast, "id" | "title" | "deadline">[];
}

export async function getBroadcast(id: string): Promise<Broadcast | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabasePublic().from("broadcasts").select("*").eq("id", id).eq("status", "published").maybeSingle();
  return (data as Broadcast | null) ?? null;
}

export async function listPojok(): Promise<(Pojok & { total: number })[]> {
  const sb = supabasePublic();
  const { data } = await sb
    .from("pojok")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Pojok[];
  const counts = await Promise.all(
    rows.map((p) =>
      sb.from("aspirations").select("id", { count: "exact", head: true }).eq("pojok_id", p.id).eq("status", "visible"),
    ),
  );
  return rows.map((p, i) => ({ ...p, total: counts[i].count ?? 0 }));
}

export async function getPojok(slug: string): Promise<Pojok | null> {
  const { data } = await supabasePublic().from("pojok").select("*").eq("slug", slug).eq("is_visible", true).maybeSingle();
  return (data as Pojok | null) ?? null;
}

export async function getCloud(pojokId: string): Promise<CloudEntry[]> {
  const { data } = await supabasePublic()
    .from("pojok_cloud")
    .select("normalized,display_text,n")
    .eq("pojok_id", pojokId)
    .order("n", { ascending: false })
    .limit(80);
  return (data ?? []) as CloudEntry[];
}

export type AspirationRow = { id: string; text: string; normalized: string; created_at: string };

const ASP_COLS = "id,text,normalized,created_at";

export async function listAspirations(
  pojokId: string,
  opts: { sort?: "new" | "top"; normalized?: string; before?: string } = {},
): Promise<{ items: AspirationRow[]; next: string | null }> {
  let q = supabasePublic().from("aspirations").select(ASP_COLS).eq("pojok_id", pojokId).eq("status", "visible");
  if (opts.normalized) q = q.eq("normalized", opts.normalized);
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data } = await q.order("created_at", { ascending: false }).limit(31);
  const rows = (data ?? []) as AspirationRow[];
  const more = rows.length > 30;
  const items = rows.slice(0, 30);
  return { items, next: more ? items[items.length - 1].created_at : null };
}

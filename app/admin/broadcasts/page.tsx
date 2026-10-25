import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";
import { BroadcastTable } from "@/components/admin/BroadcastTable";
import { buttonClass } from "@/components/ui/Button";
import type { Broadcast } from "@/lib/types";

const PER_PAGE = 50;

type SP = { status?: string; cat?: string; src?: string; q?: string; page?: string };

export default async function AdminBroadcasts({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = supabaseAdmin();
  const page = Math.max(1, Number(sp.page) || 1);

  let q = db.from("broadcasts").select("*", { count: "exact" });
  if (sp.status === "published" || sp.status === "hidden") q = q.eq("status", sp.status);
  if (sp.cat && (CATEGORY_KEYS as string[]).includes(sp.cat)) q = q.eq("category", sp.cat);
  if (sp.src && ["rule", "ai", "manual"].includes(sp.src)) q = q.eq("category_source", sp.src);
  if (sp.q?.trim()) {
    const term = sp.q.trim().replace(/[%_,()]/g, " ");
    q = q.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  }
  const { data, count } = await q
    .order("received_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const head = (f: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => f(base());
  const base = () => db.from("broadcasts").select("id", { count: "exact", head: true });
  const [total, published, hidden, lainnya, today] = await Promise.all([
    head((x) => x),
    head((x) => x.eq("status", "published")),
    head((x) => x.eq("status", "hidden")),
    head((x) => x.eq("category", "lainnya")),
    head((x) => x.gte("created_at", startOfDay.toISOString())),
  ]);

  const stats = [
    ["total", total.count], ["published", published.count], ["hidden", hidden.count],
    ["belum berkategori", lainnya.count], ["hari ini", today.count],
  ] as const;

  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, String(v));
    return `/admin/broadcasts?${p}`;
  };
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="text-[22px] font-semibold">Broadcast</h1>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[13px]">
        {stats.map(([k, v]) => (
          <div key={k} className="flex gap-1.5"><dt className="text-muted">{k}</dt><dd>{v ?? 0}</dd></div>
        ))}
      </dl>

      <form className="mt-4 flex flex-wrap gap-2" action="/admin/broadcasts">
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="min-h-10 rounded-md border border-line-strong bg-surface px-2">
          <option value="">Semua status</option><option value="published">Published</option><option value="hidden">Hidden</option>
        </select>
        <select name="cat" defaultValue={sp.cat ?? ""} aria-label="Kategori" className="min-h-10 rounded-md border border-line-strong bg-surface px-2">
          <option value="">Semua kategori</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select name="src" defaultValue={sp.src ?? ""} aria-label="Sumber kategori" className="min-h-10 rounded-md border border-line-strong bg-surface px-2">
          <option value="">Semua sumber</option><option value="ai">otomatis</option><option value="rule">aturan</option><option value="manual">manual</option>
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari judul atau isi" aria-label="Cari" className="min-h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3" />
        <button type="submit" className={buttonClass("secondary")}>Terapkan</button>
      </form>

      <div className="mt-4">
        <BroadcastTable rows={(data ?? []) as Broadcast[]} />
      </div>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between font-mono text-[13px]">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className={buttonClass("secondary")}>Sebelumnya</Link> : <span />}
          <span>{page}/{pages}</span>
          {page < pages ? <Link href={qs({ page: String(page + 1) })} className={buttonClass("secondary")}>Berikutnya</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}

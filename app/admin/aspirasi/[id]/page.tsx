import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminAspirationList, type AdminAspiration } from "@/components/admin/AdminAspirationList";
import { CloudView } from "@/components/aspirasi/WordCloud";
import { PojokSwitches } from "@/components/admin/PojokSwitches";
import { buttonClass } from "@/components/ui/Button";
import type { Pojok } from "@/lib/types";

export default async function AdminPojok({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { tab = "all" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = supabaseAdmin();
  const { data: pojok } = await db.from("pojok").select("*").eq("id", id).maybeSingle();
  if (!pojok) notFound();

  // ip_hash sengaja tidak dipilih: tidak pernah dikirim ke client
  const { data } = await db
    .from("aspirations")
    .select("id,text,normalized,status,auto_flagged,created_at")
    .eq("pojok_id", id)
    .order("created_at", { ascending: false })
    .limit(1000);
  const all = (data ?? []) as AdminAspiration[];

  const groups = new Map<string, { normalized: string; display_text: string; n: number; vis: number }>();
  for (const a of all) {
    const g = groups.get(a.normalized) ?? { normalized: a.normalized, display_text: a.text, n: 0, vis: 0 };
    g.n++;
    if (a.status === "visible") g.vis++;
    groups.set(a.normalized, g);
  }
  const cloud = [...groups.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 80)
    .map((g) => ({ normalized: g.normalized, display_text: g.display_text, n: g.n, hidden: g.vis === 0 }));

  const filtered = all.filter((a) =>
    tab === "visible" ? a.status === "visible" : tab === "hidden" ? a.status === "hidden" : tab === "flagged" ? a.auto_flagged : true,
  );
  const p = pojok as Pojok;
  const tabs = [["all", "Semua"], ["visible", "Tampil"], ["hidden", "Disembunyikan"], ["flagged", "Ditandai otomatis"]] as const;

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link href="/admin/aspirasi" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-ink-2"><ArrowLeft size={18} strokeWidth={1.75} /> Pojok Aspirasi</Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">{p.title}</h1>
          <p className="text-ink-2">{p.question}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PojokSwitches id={p.id} isOpen={p.is_open} isVisible={p.is_visible} />
          <a href={`/admin/aspirasi/${p.id}/export`} className={buttonClass("secondary")}>Ekspor CSV</a>
        </div>
      </div>

      <section aria-label="Pratinjau cloud" className="mt-4 rounded-lg border border-line bg-surface p-4">
        <CloudView items={cloud} />
      </section>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Filter">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/admin/aspirasi/${p.id}?tab=${k}`} className={`flex min-h-11 flex-none items-center border-b-2 px-3 ${tab === k ? "border-green-700 font-medium" : "border-transparent text-ink-2"}`}>{label}</Link>
        ))}
      </nav>
      <div className="mt-3">
        <AdminAspirationList rows={filtered} />
      </div>
    </div>
  );
}

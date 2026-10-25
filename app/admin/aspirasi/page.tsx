import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PojokManager, type PojokRow } from "@/components/admin/PojokManager";
import type { Pojok } from "@/lib/types";

export default async function AdminAspirasi() {
  await requireAdmin();
  const db = supabaseAdmin();
  const { data } = await db.from("pojok").select("*").order("sort_order").order("created_at", { ascending: false });
  const rows: PojokRow[] = await Promise.all(
    ((data ?? []) as Pojok[]).map(async (p) => {
      const c = (f?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
        const q = base().eq("pojok_id", p.id);
        return (f ? f(q) : q).then((r) => r.count ?? 0);
      };
      const base = () => db.from("aspirations").select("id", { count: "exact", head: true });
      const [total, hidden, flagged] = await Promise.all([c(), c((q) => q.eq("status", "hidden")), c((q) => q.eq("auto_flagged", true))]);
      return { ...p, total, hidden, flagged };
    }),
  );
  return (
    <div className="mx-auto max-w-[1200px]">
      <PojokManager rows={rows} />
    </div>
  );
}

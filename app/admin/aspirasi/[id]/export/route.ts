import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const esc = (v: string) => {
  // Cegah formula injection di spreadsheet
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("not found", { status: 404 });
  const db = supabaseAdmin();
  const { data: pojok } = await db.from("pojok").select("slug").eq("id", id).maybeSingle();
  if (!pojok) return new Response("not found", { status: 404 });
  const { data } = await db
    .from("aspirations")
    .select("text,normalized,status,created_at")
    .eq("pojok_id", id)
    .order("created_at", { ascending: false });
  const lines = ["text,normalized,status,created_at"];
  for (const r of data ?? []) lines.push([esc(r.text), esc(r.normalized), esc(r.status), esc(r.created_at)].join(","));
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aspirasi-${pojok.slug}.csv"`,
    },
  });
}

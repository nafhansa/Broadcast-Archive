import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BroadcastEditor } from "@/components/admin/BroadcastEditor";
import type { Broadcast } from "@/lib/types";

export default async function EditBroadcast({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await supabaseAdmin().from("broadcasts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <BroadcastEditor key={data.updated_at} b={data as Broadcast} />;
}

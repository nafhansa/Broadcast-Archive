import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${serverEnv.CRON_SECRET}`) {
    return new NextResponse("forbidden", { status: 403 });
  }
  await supabaseAdmin().from("broadcasts").select("id").limit(1);
  return NextResponse.json({ ok: true });
}

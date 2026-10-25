import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/ui/Logo";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Masuk admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (data.user) {
    const { data: isAdmin } = await sb.rpc("is_admin");
    if (isAdmin) redirect("/admin");
  }
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <Logo height={36} />
      <h1 className="mt-4 text-[22px] font-semibold">Masuk admin</h1>
      <LoginForm next={next ?? ""} />
    </main>
  );
}

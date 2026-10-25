import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <SiteShell wide={false}>
      <h1 className="text-[22px] font-semibold md:text-[28px]">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-ink-2">Broadcast ini tidak ada, atau sudah disembunyikan.</p>
      <Link href="/" className={buttonClass("primary", "mt-4")}>Kembali ke arsip</Link>
    </SiteShell>
  );
}

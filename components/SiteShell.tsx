import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NavTabs } from "@/components/NavTabs";

export function SiteShell({ children, wide = true }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
          <Link href="/" className="flex min-h-11 items-center gap-2.5">
            <Logo height={28} />
            <span className="text-[15px] font-semibold">Broadcast Archive</span>
          </Link>
          <NavTabs variant="desktop" />
        </div>
        <NavTabs variant="mobile" />
      </header>
      <main className={`mx-auto w-full px-4 py-4 md:py-6 ${wide ? "max-w-[1200px]" : "max-w-[760px]"}`}>{children}</main>
      <footer className="mx-auto max-w-[1200px] px-4 py-8 text-[13px] text-muted">
        Arsip broadcast angkatan. Isi broadcast milik pengirim aslinya.
      </footer>
    </>
  );
}

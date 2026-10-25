"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LayoutList, LogOut, MessagesSquare } from "lucide-react";
import { signOut } from "@/app/admin/actions";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin/broadcasts", label: "Broadcast", icon: LayoutList },
  { href: "/admin/aspirasi", label: "Pojok Aspirasi", icon: MessagesSquare },
];

export function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] flex-none flex-col border-r border-line bg-surface p-3 md:flex">
      <p className="px-3 py-3 text-[15px] font-semibold">Admin</p>
      <nav className="flex flex-col gap-1">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 text-[14px] transition-colors duration-150",
              path.startsWith(i.href) ? "bg-green-50 font-medium text-green-800" : "text-ink-2 hover:bg-green-50",
            )}
          >
            <i.icon size={18} strokeWidth={1.75} /> {i.label}
          </Link>
        ))}
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-md px-3 text-[14px] text-ink-2 hover:bg-green-50">
          <ExternalLink size={18} strokeWidth={1.75} /> Lihat situs
        </Link>
      </nav>
      <form action={signOut} className="mt-auto">
        <button type="submit" className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-[14px] text-ink-2 hover:bg-green-50">
          <LogOut size={18} strokeWidth={1.75} /> Keluar
        </button>
      </form>
    </aside>
  );
}

export function AdminBottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 border-t border-line bg-surface md:hidden" aria-label="Admin">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 text-[12px]", path.startsWith(i.href) ? "text-green-800" : "text-ink-2")}
        >
          <i.icon size={18} strokeWidth={1.75} /> {i.label}
        </Link>
      ))}
      <form action={signOut} className="flex flex-1">
        <button type="submit" className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[12px] text-ink-2">
          <LogOut size={18} strokeWidth={1.75} /> Keluar
        </button>
      </form>
    </nav>
  );
}

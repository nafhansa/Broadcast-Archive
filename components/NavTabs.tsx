"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "Arsip" },
  { href: "/aspirasi", label: "Pojok Aspirasi" },
];

export function NavTabs({ variant }: { variant: "desktop" | "mobile" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/b/") : path.startsWith(href));
  if (variant === "desktop") {
    return (
      <nav className="ml-auto hidden gap-1 md:flex" aria-label="Utama">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "flex min-h-11 items-center border-b-2 px-3 text-[15px] transition-colors duration-150",
              active(i.href) ? "border-green-700 font-medium text-ink" : "border-transparent text-ink-2",
            )}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex border-t border-line md:hidden" aria-label="Utama">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "flex h-11 flex-1 items-center justify-center border-b-2 text-[14px]",
            active(i.href) ? "border-green-700 font-medium text-ink" : "border-transparent text-ink-2",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

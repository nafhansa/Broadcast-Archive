"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function SearchBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      const s = next.toString();
      router.replace(s ? `/?${s}` : "/");
    }, 300);
    return () => clearTimeout(t);
  }, [value, router]);

  return (
    <div className="relative">
      <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cari broadcast"
        aria-label="Cari broadcast"
        className="min-h-11 w-full rounded-md border border-line-strong bg-surface pl-10 pr-11 text-[15px] placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => setValue("")}
          className="absolute right-0 top-0 grid size-11 cursor-pointer place-items-center text-muted"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/cn";

function href(cat: string | undefined, q?: string) {
  const sp = new URLSearchParams();
  if (cat) sp.set("cat", cat);
  if (q) sp.set("q", q);
  const s = sp.toString();
  return s ? `/?${s}` : "/";
}

export function CategoryChips({ active, q, counts }: { active?: string; q?: string; counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <nav aria-label="Kategori" className="no-scrollbar flex gap-2 overflow-x-auto py-2">
      <Link
        href={href(undefined, q)}
        className={cn(
          "flex min-h-11 flex-none items-center gap-2 rounded-md border px-3 text-[14px] transition-colors duration-150",
          !active ? "border-green-700 bg-green-700 text-white" : "border-line bg-surface text-ink-2",
        )}
      >
        Semua <span className="font-mono text-[12px] opacity-80">{total}</span>
      </Link>
      {CATEGORIES.map((c) => (
        <Link
          key={c.key}
          href={href(c.key, q)}
          className={cn(
            "flex min-h-11 flex-none items-center gap-2 rounded-md border px-3 text-[14px] whitespace-nowrap transition-colors duration-150",
            active === c.key ? "border-green-700 bg-green-700 text-white" : "border-line bg-surface text-ink-2",
          )}
        >
          <span aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: c.color }} />
          {c.label}
          <span className="font-mono text-[12px] opacity-80">{counts[c.key] ?? 0}</span>
        </Link>
      ))}
    </nav>
  );
}

export function CategorySidebar({ active, q, counts }: { active?: string; q?: string; counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const item = (key: string | undefined, label: string, color: string | null, n: number) => (
    <Link
      key={key ?? "all"}
      href={href(key, q)}
      className={cn(
        "flex min-h-10 items-center gap-2 border-l-2 px-3 text-[14px] transition-colors duration-150",
        active === key ? "border-green-700 bg-green-50 font-medium text-green-800" : "border-transparent text-ink-2 hover:bg-green-50",
      )}
    >
      {color ? <span aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: color }} /> : <span className="size-2" />}
      <span className="flex-1">{label}</span>
      <span className="font-mono text-[12px] text-muted">{n}</span>
    </Link>
  );
  return (
    <nav aria-label="Kategori" className="sticky top-[72px] flex flex-col">
      {item(undefined, "Semua", null, total)}
      {CATEGORIES.map((c) => item(c.key, c.label, c.color, counts[c.key] ?? 0))}
    </nav>
  );
}

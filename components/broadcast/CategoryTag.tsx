import { categoryOf } from "@/lib/categories";

export function CategoryTag({ category }: { category: string }) {
  const c = categoryOf(category);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2 py-0.5 text-[13px] text-ink-2">
      <span aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

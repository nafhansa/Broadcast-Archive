"use client";

import { cn } from "@/lib/cn";
import type { CloudEntry } from "@/lib/types";

export type CloudItem = CloudEntry & { hidden?: boolean; flash?: boolean };

/** Rank 0 di tengah, rank 1 kanan, rank 2 kiri, dst, sehingga kata besar berkumpul di tengah. */
export function arrange<T>(sortedDesc: T[]): T[] {
  const left: T[] = [];
  const right: T[] = [];
  sortedDesc.slice(1).forEach((item, i) => {
    if (i % 2 === 0) right.push(item);
    else left.unshift(item);
  });
  return sortedDesc.length ? [...left, sortedDesc[0], ...right] : [];
}

function colorFor(rank: number) {
  if (rank === 0) return "var(--color-green-800)";
  if (rank <= 4) return "var(--color-green-700)";
  return rank % 2 ? "var(--color-green-600)" : "var(--color-sand-ink)";
}

export function CloudView({
  items, onSelect, selected, minHeight = true,
}: {
  items: CloudItem[];
  onSelect?: (normalized: string) => void;
  selected?: string | null;
  minHeight?: boolean;
}) {
  const sorted = [...items].sort((a, b) => b.n - a.n || a.normalized.localeCompare(b.normalized));
  const maxN = sorted[0]?.n ?? 1;
  const rankOf = new Map(sorted.map((s, i) => [s.normalized, i]));
  const placed = arrange(sorted);

  if (!placed.length) {
    return (
      <div className={cn("grid place-items-center text-ink-2", minHeight && "min-h-[280px] md:min-h-[380px]")}>
        Belum ada jawaban. Jadilah yang pertama.
      </div>
    );
  }
  return (
    <div
      className={cn("flex flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 md:gap-x-3.5", minHeight && "min-h-[280px] md:min-h-[380px]")}
    >
      {placed.map((w) => {
        const rank = rankOf.get(w.normalized)!;
        const f = maxN <= 1 ? 0 : Math.sqrt((w.n - 1) / (maxN - 1));
        const style = {
          fontSize: maxN <= 1 ? "18px" : `calc(14px + (var(--cloud-max) - 14px) * ${f.toFixed(3)})`,
          fontWeight: rank < 3 ? 700 : 500,
          color: colorFor(rank),
        };
        return (
          <button
            key={w.normalized}
            type="button"
            title={`${w.n} orang`}
            data-flash={w.flash ? "true" : "false"}
            onClick={() => onSelect?.(w.normalized)}
            style={style}
            className={cn(
              "cloud-word cursor-pointer text-center",
              w.hidden && "line-through opacity-35",
              selected === w.normalized && "bg-sand",
            )}
          >
            {w.display_text}
          </button>
        );
      })}
    </div>
  );
}

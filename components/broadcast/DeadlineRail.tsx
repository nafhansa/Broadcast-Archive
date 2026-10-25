import Link from "next/link";
import { deadlineParts } from "@/lib/format";

export function DeadlineRail({ items }: { items: { id: string; title: string; deadline: string | null }[] }) {
  return (
    <aside aria-label="Tenggat terdekat" className="sticky top-[72px]">
      <h2 className="mb-3 font-mono text-[13px] uppercase tracking-wide text-muted">Tenggat terdekat</h2>
      {items.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((d) => {
            const p = deadlineParts(d.deadline!);
            return (
              <li key={d.id}>
                <Link href={`/b/${d.id}`} className="flex gap-3 p-3 transition-colors duration-150 hover:bg-green-50">
                  <span className="w-12 flex-none font-mono leading-tight">
                    <span className="block text-[22px] font-semibold text-green-800">{p.day}</span>
                    <span className="block text-[12px] text-muted">{p.month}</span>
                  </span>
                  <span className="line-clamp-2 text-[14px] text-ink">{d.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-line bg-surface p-3 text-[14px] text-ink-2">Belum ada tenggat yang akan datang.</p>
      )}
    </aside>
  );
}

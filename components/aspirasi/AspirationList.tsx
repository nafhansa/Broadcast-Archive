"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { loadMoreAspirations } from "@/app/feed-actions";
import { formatRelative } from "@/lib/format";
import type { AspirationRow } from "@/lib/queries";
import type { CloudEntry } from "@/lib/types";

export function AspirationList({
  pojokId, initial, initialNext, cloud, filter, onClearFilter, local,
}: {
  pojokId: string;
  initial: AspirationRow[];
  initialNext: string | null;
  cloud: CloudEntry[];
  filter: string | null;
  onClearFilter: () => void;
  local: AspirationRow[];
}) {
  const [mode, setMode] = useState<"new" | "top">("new");
  const [items, setItems] = useState(initial);
  const [next, setNext] = useState(initialNext);
  const [pending, start] = useTransition();
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    start(async () => {
      const res = await loadMoreAspirations(pojokId, { normalized: filter ?? undefined });
      setItems(res.items);
      setNext(res.next);
    });
  }, [filter, pojokId]);

  const shownLocal = filter ? local.filter((l) => l.normalized === filter) : local;
  const merged = [...shownLocal, ...items.filter((i) => !shownLocal.some((l) => l.id === i.id))];

  return (
    <section aria-labelledby="daftar-aspirasi">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 id="daftar-aspirasi" className="text-[17px] font-semibold">Aspirasi</h2>
        <div className="ml-auto flex rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Urutan">
          {(["new", "top"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-9 cursor-pointer rounded-sm px-3 text-[14px] transition-colors duration-150 ${mode === m ? "bg-green-700 text-white" : "text-ink-2"}`}
            >
              {m === "new" ? "Terbaru" : "Terbanyak"}
            </button>
          ))}
        </div>
      </div>

      {filter ? (
        <button
          type="button"
          onClick={onClearFilter}
          className="mb-3 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md bg-sand px-3 text-[14px] text-sand-ink"
        >
          {filter} <X size={16} strokeWidth={1.75} aria-label="Hapus filter" />
        </button>
      ) : null}

      {mode === "top" ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {cloud
            .filter((c) => !filter || c.normalized === filter)
            .map((c) => (
              <li key={c.normalized} className="flex items-center justify-between gap-3 p-3">
                <span>{c.display_text}</span>
                <Badge tone="sand">{c.n}</Badge>
              </li>
            ))}
          {!cloud.length ? <li className="p-3 text-ink-2">Belum ada jawaban.</li> : null}
        </ul>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {merged.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 p-3">
                <span className="break-words">{a.text}</span>
                <time suppressHydrationWarning dateTime={a.created_at} className="flex-none font-mono text-[13px] text-muted">
                  {formatRelative(a.created_at)}
                </time>
              </li>
            ))}
            {!merged.length ? <li className="p-3 text-ink-2">{pending ? "Memuat..." : "Belum ada jawaban."}</li> : null}
          </ul>
          {next ? (
            <Button
              variant="secondary"
              className="mt-3 w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await loadMoreAspirations(pojokId, { normalized: filter ?? undefined, before: next });
                  setItems((l) => [...l, ...res.items]);
                  setNext(res.next);
                })
              }
            >
              Muat lebih banyak
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

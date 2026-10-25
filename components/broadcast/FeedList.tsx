"use client";

import { useState, useTransition } from "react";
import { BroadcastCard } from "./BroadcastCard";
import { Button } from "@/components/ui/Button";
import { loadMoreBroadcasts } from "@/app/feed-actions";
import { categoryOf } from "@/lib/categories";
import type { Broadcast, FeedParams } from "@/lib/types";

export function FeedList({
  initial, nextCursor, params,
}: {
  initial: Broadcast[];
  nextCursor: string | null;
  params: FeedParams;
}) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [pending, start] = useTransition();

  if (!items.length) {
    const msg = params.q
      ? `Tidak ada broadcast yang cocok dengan "${params.q}"`
      : params.cat
        ? `Belum ada broadcast di kategori ${categoryOf(params.cat).label}`
        : "Belum ada broadcast di arsip";
    return <p className="rounded-lg border border-line bg-surface p-6 text-ink-2">{msg}.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((b) => (
        <BroadcastCard key={b.id} b={b} />
      ))}
      {cursor ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const page = await loadMoreBroadcasts(params, cursor);
              setItems((l) => [...l, ...page.items.filter((p) => !l.some((x) => x.id === p.id))]);
              setCursor(page.nextCursor);
            })
          }
        >
          {pending ? "Memuat..." : "Muat lebih banyak"}
        </Button>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudView, type CloudItem } from "./WordCloud";
import { AspirationForm } from "./AspirationForm";
import { AspirationList } from "./AspirationList";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { normalizeAspiration } from "@/lib/aspirasi/normalize";
import type { AspirationRow } from "@/lib/queries";
import type { CloudEntry, Pojok } from "@/lib/types";

export function PojokBoard({
  pojok, initialCloud, initialItems, initialNext,
}: {
  pojok: Pojok;
  initialCloud: CloudEntry[];
  initialItems: AspirationRow[];
  initialNext: string | null;
}) {
  const [cloud, setCloud] = useState<CloudItem[]>(initialCloud);
  const [filter, setFilter] = useState<string | null>(null);
  const [local, setLocal] = useState<AspirationRow[]>([]);
  const pendingOwn = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const listRef = useRef<HTMLDivElement>(null);

  const flash = useCallback((normalized: string) => {
    setCloud((c) => c.map((e) => (e.normalized === normalized ? { ...e, flash: true } : e)));
    clearTimeout(timers.current.get(normalized));
    timers.current.set(
      normalized,
      setTimeout(() => setCloud((c) => c.map((e) => (e.normalized === normalized ? { ...e, flash: false } : e))), 700),
    );
  }, []);

  const bump = useCallback(
    (normalized: string, text: string) => {
      setCloud((c) => {
        const found = c.find((e) => e.normalized === normalized);
        if (found) return c.map((e) => (e.normalized === normalized ? { ...e, n: e.n + 1, display_text: text } : e));
        return [...c, { normalized, display_text: text, n: 1 }];
      });
      flash(normalized);
    },
    [flash],
  );

  useEffect(() => {
    const sb = supabaseBrowser();
    let refetch: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(refetch);
      refetch = setTimeout(async () => {
        const { data } = await sb
          .from("pojok_cloud")
          .select("normalized,display_text,n")
          .eq("pojok_id", pojok.id)
          .order("n", { ascending: false })
          .limit(80);
        if (data) setCloud(data as CloudEntry[]);
      }, 150);
    };
    const channel = sb
      .channel(`pojok-${pojok.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "aspirations", filter: `pojok_id=eq.${pojok.id}` }, (p) => {
        const row = p.new as { normalized: string; text: string; status: string };
        if (row.status !== "visible") return;
        const own = pendingOwn.current.get(row.normalized) ?? 0;
        if (own > 0) {
          pendingOwn.current.set(row.normalized, own - 1);
          return;
        }
        bump(row.normalized, row.text);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "aspirations", filter: `pojok_id=eq.${pojok.id}` }, reload)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "aspirations" }, reload)
      .subscribe();
    const t = timers.current;
    return () => {
      clearTimeout(refetch);
      t.forEach(clearTimeout);
      sb.removeChannel(channel);
    };
  }, [pojok.id, bump]);

  const sorted = [...cloud].sort((a, b) => b.n - a.n).slice(0, 80);

  return (
    <div className="space-y-6">
      <section aria-label="Word cloud" className="relative rounded-lg border border-line bg-surface p-4">
        <span className="absolute right-4 top-4 flex items-center gap-2 font-mono text-[12px] text-muted">
          <span className="ring-dot" aria-hidden /> live
        </span>
        <CloudView
          items={sorted}
          selected={filter}
          onSelect={(n) => {
            setFilter((cur) => (cur === n ? null : n));
            listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </section>

      {pojok.is_open ? (
        <AspirationForm
          slug={pojok.slug}
          maxLength={pojok.max_length}
          onSubmitted={(text) => {
            const normalized = normalizeAspiration(text);
            pendingOwn.current.set(normalized, (pendingOwn.current.get(normalized) ?? 0) + 1);
            bump(normalized, text);
            setLocal((l) => [{ id: `local-${Date.now()}`, text, normalized, created_at: new Date().toISOString() }, ...l]);
          }}
        />
      ) : (
        <p className="rounded-lg border border-line bg-surface p-4 text-ink-2">Pojok ini sudah ditutup.</p>
      )}

      <div ref={listRef} className="scroll-mt-32">
        <AspirationList
          pojokId={pojok.id}
          initial={initialItems}
          initialNext={initialNext}
          cloud={sorted}
          filter={filter}
          onClearFilter={() => setFilter(null)}
          local={local}
        />
      </div>
    </div>
  );
}

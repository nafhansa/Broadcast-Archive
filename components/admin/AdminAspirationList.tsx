"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { deleteAspirations, hideAspirationsBySameSender, setAspirationStatus, type Result } from "@/app/admin/actions";
import { formatRelative } from "@/lib/format";

export type AdminAspiration = {
  id: string; text: string; normalized: string; status: "visible" | "hidden"; auto_flagged: boolean; created_at: string;
};

export function AdminAspirationList({ rows }: { rows: AdminAspiration[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);

  const run = (fn: () => Promise<Result>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (ok) toast(ok);
        setSel(new Set());
        router.refresh();
      } else toast(r.error, true);
    });
  const ids = [...sel];
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (!rows.length) return <p className="rounded-lg border border-line bg-surface p-6 text-ink-2">Tidak ada aspirasi di tab ini.</p>;

  return (
    <div>
      {ids.length ? (
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-line-strong bg-surface p-2">
          <span className="px-2 font-mono text-[13px]">{ids.length} dipilih</span>
          <Button variant="secondary" disabled={pending} onClick={() => run(() => setAspirationStatus(ids, "hidden"), "Disembunyikan")}>Sembunyikan</Button>
          <Button variant="secondary" disabled={pending} onClick={() => run(() => setAspirationStatus(ids, "visible"), "Ditampilkan")}>Tampilkan</Button>
          <Button variant="danger" disabled={pending} onClick={() => setConfirm(ids)}>Hapus</Button>
        </div>
      ) : null}

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <input type="checkbox" aria-label={`Pilih ${a.text}`} checked={sel.has(a.id)} onChange={() => toggle(a.id)} className="size-5" />
            <div className="min-w-0 flex-1">
              <p className={`break-words ${a.status === "hidden" ? "text-muted line-through" : ""}`}>{a.text}</p>
              <p suppressHydrationWarning className="font-mono text-[12px] text-muted">{formatRelative(a.created_at)}</p>
            </div>
            {a.auto_flagged ? <Badge tone="danger">ditandai</Badge> : null}
            <Badge>{a.status === "visible" ? "tampil" : "hidden"}</Badge>
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" disabled={pending} onClick={() => run(() => setAspirationStatus([a.id], a.status === "visible" ? "hidden" : "visible"))}>
                {a.status === "visible" ? "Sembunyikan" : "Tampilkan"}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => run(() => hideAspirationsBySameSender(a.id), "Semua dari pengirim ini disembunyikan")}>Sembunyikan semua dari pengirim ini</Button>
              <Button variant="ghost" className="text-danger" disabled={pending} onClick={() => setConfirm([a.id])}>Hapus</Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Hapus aspirasi?"
        description={`${confirm?.length ?? 0} aspirasi akan dihapus permanen.`}
        busy={pending}
        onConfirm={() => { const t = confirm!; setConfirm(null); run(() => deleteAspirations(t), "Dihapus"); }}
      />
    </div>
  );
}

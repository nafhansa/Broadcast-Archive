"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreVertical, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/fields";
import { Switch } from "@/components/ui/Switch";
import { ConfirmDialog } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { CATEGORIES } from "@/lib/categories";
import { formatRelative } from "@/lib/format";
import {
  deleteBroadcasts, reclassifyBroadcast, setBroadcastCategory, setBroadcastStatus, toggleBroadcastPin, type Result,
} from "@/app/admin/actions";
import type { Broadcast } from "@/lib/types";

const SRC = { ai: "otomatis", rule: "aturan", manual: "manual" } as const;

export function BroadcastTable({ rows }: { rows: Broadcast[] }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Broadcast[] | null>(null);

  const run = (fn: () => Promise<Result>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (ok) toast(ok);
        router.refresh();
      } else toast(r.error, true);
    });

  const ids = [...selected];
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  if (!rows.length) return <p className="rounded-lg border border-line bg-surface p-6 text-ink-2">Tidak ada broadcast yang cocok dengan filter ini.</p>;

  return (
    <div>
      {ids.length ? (
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-line-strong bg-surface p-2">
          <span className="px-2 font-mono text-[13px]">{ids.length} dipilih</span>
          <Select
            aria-label="Ubah kategori"
            className="!w-auto"
            value=""
            onChange={(e) => e.target.value && run(() => setBroadcastCategory(ids, e.target.value), "Kategori diubah")}
          >
            <option value="">Ubah kategori...</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
          <Button variant="secondary" disabled={pending} onClick={() => run(() => setBroadcastStatus(ids, "hidden"), "Disembunyikan")}>Sembunyikan</Button>
          <Button variant="secondary" disabled={pending} onClick={() => run(() => setBroadcastStatus(ids, "published"), "Ditampilkan")}>Tampilkan</Button>
          <Button variant="danger" disabled={pending} onClick={() => setConfirm(rows.filter((r) => selected.has(r.id)))}>Hapus</Button>
        </div>
      ) : null}

      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
        <table className="w-full text-left text-[14px]">
          <thead className="border-b border-line font-mono text-[12px] uppercase text-muted">
            <tr>
              <th className="w-10 p-2">
                <input type="checkbox" aria-label="Pilih semua" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4" />
              </th>
              <th className="p-2">Judul</th><th className="p-2">Kategori</th><th className="p-2">Sumber</th>
              <th className="p-2">Grup</th><th className="p-2">Diterima</th><th className="p-2">Tampil</th><th className="p-2">Pin</th><th className="p-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "hidden" ? "opacity-60" : ""}>
                <td className="p-2"><input type="checkbox" aria-label={`Pilih ${r.title}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4" /></td>
                <td className="max-w-[320px] p-2"><Link href={`/admin/broadcasts/${r.id}`} className="line-clamp-2 font-medium hover:underline">{r.title}</Link></td>
                <td className="p-2">
                  <Select aria-label="Kategori" className="!min-h-9 !w-40" value={r.category} disabled={pending} onChange={(e) => run(() => setBroadcastCategory([r.id], e.target.value))}>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </Select>
                </td>
                <td className="p-2 font-mono text-[12px] text-muted">{SRC[r.category_source]}</td>
                <td className="p-2 text-ink-2">{r.source_group ?? "-"}</td>
                <td suppressHydrationWarning className="p-2 font-mono text-[12px] text-muted">{formatRelative(r.received_at)}</td>
                <td className="p-2"><Switch label="Tampil" checked={r.status === "published"} disabled={pending} onChange={(v) => run(() => setBroadcastStatus([r.id], v ? "published" : "hidden"))} /></td>
                <td className="p-2">
                  <button type="button" aria-label={r.pinned ? "Lepas sematan" : "Sematkan"} onClick={() => run(() => toggleBroadcastPin(r.id, !r.pinned))} className="grid size-11 cursor-pointer place-items-center text-ink-2">
                    {r.pinned ? <Pin size={18} strokeWidth={1.75} className="text-green-700" /> : <PinOff size={18} strokeWidth={1.75} />}
                  </button>
                </td>
                <td className="p-2"><RowMenu r={r} pending={pending} run={run} onDelete={() => setConfirm([r])} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-lg border border-line bg-surface p-3 ${r.status === "hidden" ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-2">
              <input type="checkbox" aria-label={`Pilih ${r.title}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="mt-1 size-5" />
              <Link href={`/admin/broadcasts/${r.id}`} className="line-clamp-2 flex-1 font-medium">{r.title}</Link>
              <RowMenu r={r} pending={pending} run={run} onDelete={() => setConfirm([r])} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Select aria-label="Kategori" className="flex-1" value={r.category} disabled={pending} onChange={(e) => run(() => setBroadcastCategory([r.id], e.target.value))}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
              <Switch label="Tampil" checked={r.status === "published"} disabled={pending} onChange={(v) => run(() => setBroadcastStatus([r.id], v ? "published" : "hidden"))} />
            </div>
            <p suppressHydrationWarning className="mt-1 font-mono text-[12px] text-muted">{SRC[r.category_source]} | {r.source_group ?? "-"} | {formatRelative(r.received_at)}</p>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Hapus permanen?"
        busy={pending}
        description={
          confirm?.length === 1
            ? `"${confirm[0].title}" dan file medianya akan dihapus dan tidak bisa dikembalikan.`
            : `${confirm?.length ?? 0} broadcast dan file medianya akan dihapus dan tidak bisa dikembalikan.`
        }
        onConfirm={() => {
          const target = confirm!.map((c) => c.id);
          setConfirm(null);
          setSelected(new Set());
          run(() => deleteBroadcasts(target), "Dihapus");
        }}
      />
    </div>
  );
}

function RowMenu({ r, pending, run, onDelete }: { r: Broadcast; pending: boolean; run: (fn: () => Promise<Result>, ok?: string) => void; onDelete: () => void }) {
  const item = "flex min-h-11 cursor-pointer items-center px-3 text-[14px] outline-none data-[highlighted]:bg-green-50";
  return (
    <DM.Root>
      <DM.Trigger aria-label="Aksi" disabled={pending} className="grid size-11 cursor-pointer place-items-center text-ink-2">
        <MoreVertical size={18} strokeWidth={1.75} />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" className="z-50 min-w-44 rounded-md border border-line-strong bg-surface py-1">
          <DM.Item asChild><Link href={`/admin/broadcasts/${r.id}`} className={item}>Edit</Link></DM.Item>
          <DM.Item className={item} onSelect={() => run(() => reclassifyBroadcast(r.id), "Diklasifikasi ulang")}>Klasifikasi ulang</DM.Item>
          <DM.Item className={item} onSelect={() => run(() => toggleBroadcastPin(r.id, !r.pinned))}>{r.pinned ? "Lepas sematan" : "Sematkan"}</DM.Item>
          <DM.Item asChild><Link href={`/b/${r.id}`} target="_blank" className={item}>Buka publik</Link></DM.Item>
          <DM.Item className={`${item} text-danger`} onSelect={onDelete}>Hapus</DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

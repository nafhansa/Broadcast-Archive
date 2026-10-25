"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/Confirm";
import { Input, Label, Textarea } from "@/components/ui/fields";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { createPojok, deletePojok, updatePojok, type Result } from "@/app/admin/actions";
import { clientEnv } from "@/lib/env";
import type { Pojok } from "@/lib/types";

export type PojokRow = Pojok & { total: number; hidden: number; flagged: number };

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function PojokManager({ rows }: { rows: PojokRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState<PojokRow | null>(null);

  const run = (fn: () => Promise<Result>, ok?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (ok) toast(ok);
        after?.();
        router.refresh();
      } else toast(r.error, true);
    });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Pojok Aspirasi</h1>
        <Button onClick={() => setCreating(true)}>Buat Pojok</Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-line bg-surface p-6 text-ink-2">Belum ada pojok. Buat satu untuk mulai mengumpulkan aspirasi.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((p) => (
            <li key={p.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/aspirasi/${p.id}`} className="text-[16px] font-semibold hover:underline">{p.title}</Link>
                  <p className="font-mono text-[12px] text-muted">/aspirasi/{p.slug}</p>
                  <p className="mt-1 font-mono text-[13px] text-ink-2">{p.total} jawaban | {p.hidden} disembunyikan | {p.flagged} ditandai</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4">
                  <label className="flex items-center gap-1 text-[13px]">Dibuka<Switch label="Dibuka" checked={p.is_open} disabled={pending} onChange={(v) => run(() => updatePojok(p.id, { is_open: v }))} /></label>
                  <label className="flex items-center gap-1 text-[13px]">Tampil<Switch label="Tampil" checked={p.is_visible} disabled={pending} onChange={(v) => run(() => updatePojok(p.id, { is_visible: v }))} /></label>
                  <label className="flex items-center gap-2 text-[13px]">Urutan
                    <input type="number" defaultValue={p.sort_order} aria-label="Urutan" className="min-h-10 w-16 rounded-md border border-line-strong px-2 font-mono"
                      onBlur={(e) => Number(e.target.value) !== p.sort_order && run(() => updatePojok(p.id, { sort_order: Number(e.target.value) }))} />
                  </label>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/aspirasi/${p.id}`} className="inline-flex min-h-10 items-center rounded-md border border-line-strong px-3">Kelola</Link>
                <Button variant="secondary" onClick={async () => {
                  await navigator.clipboard.writeText(`${clientEnv.NEXT_PUBLIC_SITE_URL}/aspirasi/${p.slug}`).catch(() => {});
                  toast("Link tersalin");
                }}><Copy size={16} strokeWidth={1.75} />Salin link</Button>
                <Button variant="ghost" className="text-danger" onClick={() => setDel(p)}><Trash2 size={16} strokeWidth={1.75} />Hapus</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateDialog open={creating} onOpenChange={setCreating} onCreated={() => { setCreating(false); router.refresh(); }} />
      <ConfirmDialog
        key={del?.id}
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Hapus pojok?"
        description={`Pojok "${del?.title}" beserta ${del?.total ?? 0} jawabannya akan dihapus permanen.`}
        typeToConfirm={del?.slug}
        busy={pending}
        onConfirm={() => { const id = del!.id; setDel(null); run(() => deletePojok(id), "Pojok dihapus"); }}
      />
    </>
  );
}

function CreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ title: "", question: "", description: "", slug: "", max_length: 80, is_open: true });
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Buat Pojok">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createPojok({ ...f, description: f.description || null });
            if (r.ok) { toast("Pojok dibuat"); setF({ title: "", question: "", description: "", slug: "", max_length: 80, is_open: true }); setSlugTouched(false); onCreated(); }
            else toast(r.error, true);
          });
        }}
      >
        <div><Label htmlFor="p-title">Judul</Label>
          <Input id="p-title" required value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value, slug: slugTouched ? s.slug : slugify(e.target.value) }))} /></div>
        <div><Label htmlFor="p-q">Pertanyaan</Label><Input id="p-q" required value={f.question} onChange={(e) => setF((s) => ({ ...s, question: e.target.value }))} /></div>
        <div><Label htmlFor="p-d">Deskripsi (opsional)</Label><Textarea id="p-d" rows={2} value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div><Label htmlFor="p-s">Slug</Label><Input id="p-s" required className="font-mono" value={f.slug} onChange={(e) => { setSlugTouched(true); setF((s) => ({ ...s, slug: slugify(e.target.value) })); }} /></div>
        <div><Label htmlFor="p-m">Maks. karakter (10 sampai 280)</Label><Input id="p-m" type="number" min={10} max={280} value={f.max_length} onChange={(e) => setF((s) => ({ ...s, max_length: Number(e.target.value) }))} /></div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-5" checked={f.is_open} onChange={(e) => setF((s) => ({ ...s, is_open: e.target.checked }))} /> Langsung dibuka</label>
        <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Membuat..." : "Buat"}</Button></div>
      </form>
    </Dialog>
  );
}

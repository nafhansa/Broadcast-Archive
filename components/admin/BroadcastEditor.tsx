"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/fields";
import { useToast } from "@/components/ui/Toast";
import { BroadcastCard } from "@/components/broadcast/BroadcastCard";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { formatFullDate } from "@/lib/format";
import { labelFor } from "@/lib/telegram/parse";
import { reclassifyBroadcast, reextractLinks, updateBroadcast } from "@/app/admin/actions";
import type { Broadcast } from "@/lib/types";

export function BroadcastEditor({ b }: { b: Broadcast }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    title: b.title, body: b.body, category: b.category as CategoryKey, source_group: b.source_group ?? "",
    sender: b.sender ?? "", deadline: b.deadline ?? "", status: b.status, pinned: b.pinned,
  });
  const [links, setLinks] = useState(b.links);
  const [media, setMedia] = useState(b.media);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const preview: Broadcast = { ...b, ...f, deadline: f.deadline || null, source_group: f.source_group || null, sender: f.sender || null, links, media };

  function save() {
    start(async () => {
      const r = await updateBroadcast(b.id, {
        ...f, source_group: f.source_group || null, sender: f.sender || null, deadline: f.deadline || null, links, media,
      });
      if (r.ok) {
        toast("Tersimpan");
        router.refresh();
      } else toast(r.error, true);
    });
  }

  const move = (i: number, d: -1 | 1) =>
    setLinks((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link href="/admin/broadcasts" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-ink-2"><ArrowLeft size={18} strokeWidth={1.75} /> Broadcast</Link>
      <h1 className="mb-4 text-[22px] font-semibold">Edit broadcast</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
          <div><Label htmlFor="title">Judul</Label><Input id="title" value={f.title} onChange={(e) => set("title", e.target.value)} required /></div>
          <div><Label htmlFor="body">Isi</Label><Textarea id="body" rows={14} value={f.body} onChange={(e) => set("body", e.target.value)} required /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cat">Kategori</Label>
              <Select id="cat" value={f.category} onChange={(e) => set("category", e.target.value as CategoryKey)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={f.status} onChange={(e) => set("status", e.target.value as "published" | "hidden")}>
                <option value="published">Published</option><option value="hidden">Hidden</option>
              </Select>
            </div>
            <div><Label htmlFor="grp">Grup</Label><Input id="grp" value={f.source_group} onChange={(e) => set("source_group", e.target.value)} /></div>
            <div><Label htmlFor="snd">Pengirim</Label><Input id="snd" value={f.sender} onChange={(e) => set("sender", e.target.value)} /></div>
            <div><Label htmlFor="dl">Tenggat</Label><Input id="dl" type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} /></div>
            <label className="flex min-h-11 items-center gap-2 self-end"><input type="checkbox" className="size-5" checked={f.pinned} onChange={(e) => set("pinned", e.target.checked)} /> Sematkan di atas</label>
          </div>

          <fieldset className="space-y-2 rounded-lg border border-line bg-surface p-3">
            <legend className="px-1 text-[13px] font-medium text-ink-2">Link</legend>
            {links.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input aria-label="Label" className="!w-36" value={l.label} onChange={(e) => setLinks((s) => s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <Input aria-label="URL" className="min-w-0 flex-1" value={l.url} onChange={(e) => setLinks((s) => s.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                <button type="button" aria-label="Naik" onClick={() => move(i, -1)} className="grid size-11 cursor-pointer place-items-center"><ArrowUp size={18} strokeWidth={1.75} /></button>
                <button type="button" aria-label="Turun" onClick={() => move(i, 1)} className="grid size-11 cursor-pointer place-items-center"><ArrowDown size={18} strokeWidth={1.75} /></button>
                <button type="button" aria-label="Hapus link" onClick={() => setLinks((s) => s.filter((_, j) => j !== i))} className="grid size-11 cursor-pointer place-items-center text-danger"><Trash2 size={18} strokeWidth={1.75} /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => {
                const url = window.prompt("URL (http/https)");
                if (!url || !/^https?:\/\//i.test(url)) return;
                try { setLinks((s) => [...s, { url, ...labelFor(url) }]); } catch { toast("URL tidak valid", true); }
              }}>Tambah link</Button>
              <Button variant="secondary" onClick={() => start(async () => {
                const r = await reextractLinks(b.id);
                if (r.ok && r.links) setLinks(r.links as Broadcast["links"]);
                else if (!r.ok) toast(r.error, true);
              })}>Ekstrak ulang dari isi</Button>
            </div>
          </fieldset>

          {media.length ? (
            <fieldset className="rounded-lg border border-line bg-surface p-3">
              <legend className="px-1 text-[13px] font-medium text-ink-2">Media</legend>
              <div className="flex flex-wrap gap-3">
                {media.map((m) => (
                  <div key={m.path} className="relative">
                    {m.mime.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="size-24 rounded-md border border-line object-cover" />
                    ) : (
                      <div className="grid size-24 place-items-center rounded-md border border-line font-mono text-[12px]">PDF</div>
                    )}
                    <button type="button" aria-label="Hapus media" onClick={() => setMedia((s) => s.filter((x) => x.path !== m.path))} className="absolute -right-2 -top-2 grid size-8 cursor-pointer place-items-center rounded-full border border-line bg-surface text-danger"><Trash2 size={16} strokeWidth={1.75} /></button>
                  </div>
                ))}
              </div>
            </fieldset>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "Menyimpan..." : "Simpan"}</Button>
        </form>

        <aside className="space-y-4">
          <div>
            <p className="mb-2 font-mono text-[12px] uppercase text-muted">Pratinjau</p>
            <BroadcastCard b={preview} />
          </div>
          <dl className="space-y-1 rounded-lg border border-line bg-surface p-3 font-mono text-[12px]">
            <div className="flex justify-between gap-3"><dt className="text-muted">sumber</dt><dd>{b.category_source === "ai" ? "otomatis" : b.category_source}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">model</dt><dd className="truncate">{b.ai_model ?? "-"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">confidence</dt><dd>{b.ai_confidence?.toFixed(2) ?? "-"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">dibuat</dt><dd suppressHydrationWarning>{formatFullDate(b.created_at)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">diubah</dt><dd suppressHydrationWarning>{formatFullDate(b.updated_at)}</dd></div>
          </dl>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" disabled={pending} onClick={() => start(async () => {
              const r = await reclassifyBroadcast(b.id);
              if (r.ok) { toast("Diklasifikasi ulang"); router.refresh(); } else toast(r.error, true);
            })}>Klasifikasi ulang dengan AI</Button>
            <Link href={`/b/${b.id}`} target="_blank" className={buttonClass("secondary")}>Buka publik</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

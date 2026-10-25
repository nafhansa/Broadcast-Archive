"use client";

import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function DetailActions({ body, title }: { body: string; title: string }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      toast("Tersalin");
    } catch {
      toast("Gagal menyalin", true);
    }
  }
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      toast("Link tersalin");
    }
  }
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={copy}><Copy size={18} strokeWidth={1.75} />Salin teks</Button>
      <Button variant="secondary" onClick={share}><Share2 size={18} strokeWidth={1.75} />Bagikan</Button>
    </div>
  );
}

export function StickyBar({ body, primary }: { body: string; primary?: { url: string; label: string } }) {
  const toast = useToast();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-surface p-3 md:hidden">
      {primary ? (
        <a
          href={primary.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-green-700 px-4 text-[15px] font-medium text-white active:bg-green-800"
        >
          {primary.label}
        </a>
      ) : null}
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(body);
            toast("Tersalin");
          } catch {
            toast("Gagal menyalin", true);
          }
        }}
      >
        Salin teks
      </Button>
    </div>
  );
}

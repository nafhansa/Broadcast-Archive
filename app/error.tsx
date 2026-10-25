"use client";

import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-10">
      <h1 className="text-[22px] font-semibold md:text-[28px]">Terjadi kesalahan</h1>
      <p className="mt-2 text-ink-2">Data tidak bisa dimuat. Jika baru lama tidak dipakai, database mungkin sedang dipulihkan.</p>
      <Button className="mt-4" onClick={reset}>Coba lagi</Button>
    </main>
  );
}

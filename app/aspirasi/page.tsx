import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { listPojok } from "@/lib/queries";

export const revalidate = 60;
export const metadata: Metadata = { title: "Pojok Aspirasi" };

export default async function AspirasiPage() {
  const list = await listPojok();
  return (
    <SiteShell wide={false}>
      <h1 className="text-[22px] font-semibold md:text-[28px]">Pojok Aspirasi</h1>
      <p className="mt-1 text-ink-2">Tulis aspirasimu tanpa login. Jawaban yang sama akan tampil makin besar.</p>

      <div className="mt-5 flex flex-col gap-3">
        {list.length ? (
          list.map((p) => (
            <Link
              key={p.id}
              href={`/aspirasi/${p.slug}`}
              className="rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold">{p.title}</h2>
                {p.is_open ? (
                  <span className="flex items-center gap-2 text-[13px] text-ink-2"><span className="ring-dot" aria-hidden />Dibuka</span>
                ) : (
                  <span className="text-[13px] text-muted">Ditutup</span>
                )}
              </div>
              <p className="mt-1 text-ink-2">{p.question}</p>
              <p className="mt-2 font-mono text-[13px] text-muted">{p.total} jawaban</p>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-line bg-surface p-6 text-ink-2">Belum ada pojok aspirasi yang dibuka.</p>
        )}
      </div>
    </SiteShell>
  );
}

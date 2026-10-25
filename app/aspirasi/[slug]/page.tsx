import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { PojokBoard } from "@/components/aspirasi/PojokBoard";
import { getCloud, getPojok, listAspirations } from "@/lib/queries";

export const revalidate = 30;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPojok((await params).slug);
  return p ? { title: p.title, description: p.question } : {};
}

export default async function PojokPage({ params }: Props) {
  const pojok = await getPojok((await params).slug);
  if (!pojok) notFound();
  const [cloud, list] = await Promise.all([getCloud(pojok.id), listAspirations(pojok.id)]);

  return (
    <SiteShell wide={false}>
      <Link href="/aspirasi" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[15px] text-ink-2">
        <ArrowLeft size={18} strokeWidth={1.75} /> Pojok Aspirasi
      </Link>
      <h1 className="mt-2 text-[22px] font-semibold leading-snug md:text-[28px]">{pojok.question}</h1>
      <p className="mt-1 font-mono text-[13px] text-muted">{pojok.title}</p>
      {pojok.description ? <p className="mt-2 text-ink-2">{pojok.description}</p> : null}
      <div className="mt-5">
        <PojokBoard pojok={pojok} initialCloud={cloud} initialItems={list.items} initialNext={list.next} />
      </div>
    </SiteShell>
  );
}

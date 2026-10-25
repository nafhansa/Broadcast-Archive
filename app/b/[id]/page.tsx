import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { CategoryTag } from "@/components/broadcast/CategoryTag";
import { LinkButtons } from "@/components/broadcast/LinkButtons";
import { RichText } from "@/components/broadcast/RichText";
import { DetailActions, StickyBar } from "@/components/broadcast/DetailActions";
import { buttonClass } from "@/components/ui/Button";
import { getBroadcast } from "@/lib/queries";
import { formatFullDate, formatDeadline } from "@/lib/format";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBroadcast((await params).id);
  if (!b) return {};
  return { title: b.title, description: b.body.replace(/\s+/g, " ").slice(0, 160), openGraph: { title: b.title, description: b.body.replace(/\s+/g, " ").slice(0, 160) } };
}

export default async function BroadcastPage({ params }: Props) {
  const b = await getBroadcast((await params).id);
  if (!b) notFound();
  const images = b.media.filter((m) => m.mime.startsWith("image/"));
  const pdfs = b.media.filter((m) => m.mime === "application/pdf");

  return (
    <SiteShell wide={false}>
      <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[15px] text-ink-2">
        <ArrowLeft size={18} strokeWidth={1.75} /> Arsip
      </Link>

      <article className={`mt-2 ${b.links.length ? "pb-20 md:pb-0" : ""}`}>
        <CategoryTag category={b.category} />
        <h1 className="mt-3 text-[22px] font-semibold leading-snug md:text-[28px]">{b.title}</h1>
        <p className="mt-2 font-mono text-[13px] text-muted">
          {[b.source_group, b.sender, formatFullDate(b.received_at)].filter(Boolean).join("  |  ")}
        </p>
        {b.deadline ? <p className="mt-1 font-mono text-[13px] text-ink-2">Tenggat {formatDeadline(b.deadline)}</p> : null}

        <div className="mt-5 text-ink">
          <RichText text={b.body} />
        </div>

        {images.length ? (
          <div className="mt-5 flex flex-col gap-3">
            {images.map((m) => (
              <a key={m.path} href={m.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="w-full rounded-lg border border-line" />
              </a>
            ))}
          </div>
        ) : null}
        {pdfs.map((m) => (
          <div key={m.path} className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
            <FileText size={18} strokeWidth={1.75} className="text-muted" aria-hidden />
            <span className="flex-1 truncate font-mono text-[13px]">{m.path.split("/").pop()}</span>
            <a href={m.url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>Buka PDF</a>
          </div>
        ))}

        {b.links.length ? (
          <div className="mt-6 hidden md:block">
            <LinkButtons links={b.links} />
          </div>
        ) : null}
        <div className="mt-6 hidden md:block">
          <DetailActions body={b.body} title={b.title} />
        </div>
        <div className="mt-6 md:hidden">
          <LinkButtons links={b.links} />
        </div>
      </article>
      <StickyBar body={b.body} primary={b.links[0] ? { url: b.links[0].url, label: b.links[0].label } : undefined} />
    </SiteShell>
  );
}

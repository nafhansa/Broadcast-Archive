import Link from "next/link";
import { CategoryTag } from "./CategoryTag";
import { LinkButtons } from "./LinkButtons";
import { daysUntil, formatDeadline, formatRelative, isNew } from "@/lib/format";
import type { Broadcast } from "@/lib/types";

export function BroadcastCard({ b }: { b: Broadcast }) {
  const image = b.media.find((m) => m.mime.startsWith("image/"));
  const left = b.deadline ? daysUntil(b.deadline) : null;
  return (
    <article className="relative rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CategoryTag category={b.category} />
        {b.pinned ? <span className="text-[13px] text-sand-ink">Disematkan</span> : null}
        {isNew(b.received_at) ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
            <span className="ring-dot" aria-hidden /> baru
          </span>
        ) : null}
        <time dateTime={b.received_at} suppressHydrationWarning className="ml-auto font-mono text-[13px] text-muted">
          {formatRelative(b.received_at)}
        </time>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-snug line-clamp-2">
            <Link href={`/b/${b.id}`} className="after:absolute after:inset-0 after:content-['']">
              {b.title}
            </Link>
          </h2>
          <p className="mt-1.5 whitespace-pre-line text-[15px] text-ink-2 line-clamp-3">{b.body}</p>
        </div>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" loading="lazy" className="size-[72px] flex-none rounded-md border border-line object-cover" />
        ) : null}
      </div>

      {b.deadline && left !== null ? (
        <p
          className={`mt-3 font-mono text-[13px] ${left < 0 ? "text-danger" : left <= 3 ? "text-warn" : "text-ink-2"}`}
        >
          Tenggat {formatDeadline(b.deadline)}
        </p>
      ) : null}

      {b.links.length ? (
        <div className="mt-3">
          <LinkButtons links={b.links} compact />
        </div>
      ) : null}
    </article>
  );
}

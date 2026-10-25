import { ExternalLink } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import type { LinkItem } from "@/lib/telegram/parse";

export function LinkButtons({ links, compact = false }: { links: LinkItem[]; compact?: boolean }) {
  if (!links.length) return null;
  const shown = compact ? links.slice(0, 2) : links;
  const rest = links.length - shown.length;
  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      {shown.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("link", "relative z-10 justify-between md:justify-center")}
        >
          <span className="truncate">{l.label}</span>
          <ExternalLink size={18} strokeWidth={1.75} aria-hidden />
        </a>
      ))}
      {rest > 0 ? <span className="font-mono text-[13px] text-muted">+{rest} link</span> : null}
    </div>
  );
}

import type { ReactNode } from "react";

// Tokenizer sederhana format WhatsApp: *tebal*, _miring_, dan URL. Tanpa dangerouslySetInnerHTML.
const TOKEN = /(https?:\/\/[^\s<>"'`]+)|\*([^*\n]+)\*|_([^_\n]+)_/g;

function link(raw: string, key: string): ReactNode {
  const url = raw.replace(/[.,;:!?)\]}>"']+$/, "");
  const tail = raw.slice(url.length);
  let safe = false;
  try {
    safe = ["http:", "https:"].includes(new URL(url).protocol);
  } catch {}
  if (!safe) return raw;
  return (
    <span key={key}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-green-700 underline underline-offset-2">
        {url}
      </a>
      {tail}
    </span>
  );
}

export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const key = `t${i++}`;
    if (m[1]) out.push(link(m[1], key));
    else if (m[2]) out.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={key}>{m[3]}</em>);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <div className="whitespace-pre-wrap break-words leading-relaxed">{out}</div>;
}

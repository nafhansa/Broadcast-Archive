export type ParsedHeader = { group: string | null; sender: string | null; body: string };

// Baris pertama opsional: "#Nama Grup | Nama Pengirim"
const HEADER = /^#([^|\n]+?)\s*(?:\|\s*([^\n]+?))?\s*\n+([\s\S]+)$/;

export function parseHeader(raw: string): ParsedHeader {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const m = text.match(HEADER);
  if (!m) return { group: null, sender: null, body: text };
  return { group: m[1].trim() || null, sender: m[2]?.trim() || null, body: m[3].trim() };
}

export type LinkKind = "form" | "drive" | "instagram" | "whatsapp" | "zoom" | "meet" | "youtube" | "linkedin" | "web";
export type LinkItem = { url: string; label: string; kind: LinkKind };

export type TgEntity = { type: string; offset: number; length: number; url?: string };

const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"'`]+|\b(?:bit\.ly|s\.id|forms\.gle|linktr\.ee|wa\.me|tinyurl\.com|lnkd\.in)\/[^\s<>"'`]+/gi;

export function normalizeUrl(u: string): string | null {
  let s = u.trim().replace(/[.,;:!?)\]}>"']+$/g, "");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const url = new URL(s);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function labelFor(url: string): { label: string; kind: LinkKind } {
  const parsed = new URL(url);
  const h = parsed.hostname.replace(/^www\./, "");
  const p = parsed.pathname;
  if (h === "forms.gle" || (h === "docs.google.com" && p.startsWith("/forms"))) return { label: "Isi Form", kind: "form" };
  if (h === "drive.google.com" || h === "docs.google.com") return { label: "Buka Dokumen", kind: "drive" };
  if (h.endsWith("instagram.com")) return { label: "Lihat Instagram", kind: "instagram" };
  if (h === "wa.me" || h.endsWith("whatsapp.com")) return { label: "Chat WhatsApp", kind: "whatsapp" };
  if (h.endsWith("zoom.us")) return { label: "Join Zoom", kind: "zoom" };
  if (h === "meet.google.com") return { label: "Join Meet", kind: "meet" };
  if (h.endsWith("youtube.com") || h === "youtu.be") return { label: "Tonton", kind: "youtube" };
  if (h.endsWith("linkedin.com") || h === "lnkd.in") return { label: "Buka LinkedIn", kind: "linkedin" };
  return { label: h, kind: "web" };
}

export function extractLinks(text: string, entities: TgEntity[] = []): LinkItem[] {
  const found: string[] = [];
  for (const e of entities) {
    if (e.type === "text_link" && e.url) found.push(e.url);
    if (e.type === "url") found.push(text.slice(e.offset, e.offset + e.length)); // offset Telegram = UTF-16, sama dengan JS string
  }
  for (const m of text.matchAll(URL_RE)) found.push(m[0]);
  const seen = new Set<string>();
  const out: LinkItem[] = [];
  for (const raw of found) {
    const url = normalizeUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, ...labelFor(url) });
  }
  return out.slice(0, 8);
}

export function makeTitleFallback(body: string): string {
  const first =
    body
      .split("\n")
      .map((l) => l.replace(/[*_~`#>]+/g, "").trim())
      .find((l) => l.length >= 4) ?? body;
  return first.length > 90 ? first.slice(0, 87).trimEnd() + "..." : first;
}

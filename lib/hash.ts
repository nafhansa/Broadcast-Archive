export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeForHash(body: string): string {
  return body.toLowerCase().replace(/[*_~]/g, "").replace(/\s+/g, " ").trim();
}

export async function contentHash(body: string): Promise<string> {
  return sha256(normalizeForHash(body));
}

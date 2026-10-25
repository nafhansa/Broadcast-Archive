export function normalizeAspiration(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "") // emoji
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // tanda baca
    .replace(/\s+/g, " ")
    .trim();
}

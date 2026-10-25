// Daftar bisa diedit. Dicocokkan per token setelah normalisasi leetspeak sederhana.
export const BLOCKLIST = [
  "anjing", "anjir", "bangsat", "bajingan", "brengsek", "kontol", "memek", "ngentot", "pepek", "jancok", "jancuk",
  "asu", "tolol", "goblok", "kampret", "sialan", "keparat", "babi", "tai", "taik", "bangke", "pantek",
  "cukimai", "kimak", "pelacur", "lonte", "jablay", "bokep", "coli", "colmek",
  "kafir", "negro", "nigger", "nigga", "faggot", "retard",
  "fuck", "fucking", "shit", "bitch", "asshole", "bastard", "dick", "pussy", "cunt", "whore", "slut",
];

const LEET: Record<string, string> = { "4": "a", "1": "i", "0": "o", "3": "e", "5": "s", "@": "a", "$": "s" };

const blocked = new Set(BLOCKLIST);

function deleet(s: string): string {
  return s.toLowerCase().replace(/[41035@$]/g, (c) => LEET[c] ?? c);
}

export function isFlagged(text: string): boolean {
  const base = text.normalize("NFKC").toLowerCase();
  const variants = [base, deleet(base)];
  for (const v of variants) {
    const tokens = v.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (tokens.some((t) => blocked.has(t))) return true;
    // kata ditulis dengan huruf ganda ("anjiiing")
    if (tokens.some((t) => blocked.has(t.replace(/(.)\1+/g, "$1")))) return true;
  }
  return false;
}

import type { CategoryKey } from "@/lib/categories";

const KEYWORDS: Record<Exclude<CategoryKey, "lainnya">, string[]> = {
  magang: ["magang", "internship", "intern", "mbkm", "kampus merdeka", "msib", "summer program"],
  loker: ["lowongan kerja", "loker", "hiring", "we are hiring", "full time", "part time", "freelance", "job opening", "vacancy", "rekrutmen karyawan"],
  akademik: ["kuliah", "kelas", "uts", "uas", "quiz", "kuis", "tugas", "dosen", "asisten", "praktikum", "krs", "perwalian", "nilai", "jadwal", "prodi", "sidang", "wisuda", "tpb", "six"],
  proker_hmif: ["hmif", "himpunan", "kahim", "badan pengurus", "bp hmif", "open recruitment hmif", "proker"],
  kegiatan_angkatan: ["angkatan", "makrab", "bukber", "foto angkatan", "iuran angkatan", "kumpul angkatan", "ketua angkatan"],
  kegiatan_eksternal: ["webinar", "seminar", "workshop", "talkshow", "bootcamp", "open house", "career fair", "unit", "kabinet km itb"],
  perlombaan: ["lomba", "kompetisi", "competition", "hackathon", "ctf", "cari tim", "call for team", "juara", "olimpiade", "gemastik"],
  merch: ["merch", "merchandise", "pre order", "preorder", "po ", "jaket", "kaos", "hoodie", "totebag", "stiker", "danus"],
  beasiswa: ["beasiswa", "scholarship", "bantuan dana", "lpdp", "djarum", "bca finance", "kip"],
};

function norm(s: string): string {
  return ` ${s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ")} `;
}

function count(haystack: string, kw: string): number {
  // kata kunci berakhiran spasi ("po ") dicocokkan sebagai kata utuh
  const needle = ` ${kw.trim()} `;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length - 1);
  }
  return n;
}

export function classifyByRules(title: string, body: string): CategoryKey {
  const t = norm(title);
  const b = norm(body);
  let best: CategoryKey = "lainnya";
  let bestScore = 0;
  for (const [key, kws] of Object.entries(KEYWORDS) as [CategoryKey, string[]][]) {
    let score = 0;
    for (const kw of kws) score += count(b, kw) + 2 * count(t, kw);
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6, jul: 7, agu: 8, agt: 8, sep: 9, okt: 10, nov: 11, des: 12,
};

const DATE_TEXT = /(\d{1,2})\s(jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des)[a-z]*\s?(\d{0,4})/gi;
const DATE_NUM = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g;
const KEY = /(deadline|batas|paling lambat|ditutup|close|sebelum)/gi;

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function validDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** today: "YYYY-MM-DD" (zona Jakarta). Mengembalikan tanggal terdekat di masa depan setelah kata kunci tenggat. */
export function extractDeadline(text: string, today: string): string | null {
  const [ty, tm, td] = today.split("-").map(Number);
  const todayMs = Date.UTC(ty, tm - 1, td);
  const candidates: string[] = [];

  for (const k of text.matchAll(KEY)) {
    const start = k.index! + k[0].length;
    const window = text.slice(start, start + 60);
    const found: { idx: number; y: number; m: number; d: number; explicitYear: boolean }[] = [];

    for (const m of window.matchAll(DATE_TEXT)) {
      const yr = m[3] ? Number(m[3]) : 0;
      found.push({
        idx: m.index!, d: Number(m[1]), m: MONTHS[m[2].toLowerCase()],
        y: yr >= 100 ? yr : yr > 0 ? 2000 + yr : ty, explicitYear: yr > 0,
      });
    }
    for (const m of window.matchAll(DATE_NUM)) {
      const yr = Number(m[3]);
      found.push({ idx: m.index!, d: Number(m[1]), m: Number(m[2]), y: yr < 100 ? 2000 + yr : yr, explicitYear: true });
    }
    found.sort((a, b) => a.idx - b.idx);
    const first = found[0];
    if (!first || !validDate(first.y, first.m, first.d)) continue;

    let { y } = first;
    if (!first.explicitYear) {
      const ms = Date.UTC(y, first.m - 1, first.d);
      if (todayMs - ms > 30 * 86400000) y += 1;
    }
    if (validDate(y, first.m, first.d)) candidates.push(iso(y, first.m, first.d));
  }

  if (!candidates.length) return null;
  const future = candidates.filter((c) => c >= today).sort();
  return future[0] ?? candidates.sort().at(-1) ?? null;
}

export function todayJakarta(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

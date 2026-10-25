const TZ = "Asia/Jakarta";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function parts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday);
  return { y: +o.year, m: +o.month, d: +o.day, hh: o.hour === "24" ? "00" : o.hour, mm: o.minute, dow };
}

export function formatShortDate(iso: string): string {
  const p = parts(new Date(iso));
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

export function formatFullDate(iso: string): string {
  const p = parts(new Date(iso));
  return `${DAYS[p.dow]}, ${p.d} ${MONTHS[p.m - 1]} ${p.y} ${p.hh}.${p.mm} WIB`;
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d <= 7) return `${d} hari lalu`;
  return formatShortDate(iso);
}

export const isNew = (iso: string, now = Date.now()) => now - new Date(iso).getTime() < 24 * 3600 * 1000;

/** "YYYY-MM-DD" -> hari tersisa dari hari ini (zona Jakarta). Negatif = lewat. */
export function daysUntil(date: string, now = new Date()): number {
  const p = parts(now);
  const today = Date.UTC(p.y, p.m - 1, p.d);
  const [y, m, d] = date.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
}

export function formatDeadline(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function deadlineParts(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return { day: String(d), month: MONTHS[m - 1].toUpperCase() };
}

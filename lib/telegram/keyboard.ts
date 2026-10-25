import { CATEGORIES } from "@/lib/categories";
import type { InlineKeyboard } from "./api";
import { clientEnv } from "@/lib/env";

export function categoryKeyboard(id: string, active: string): InlineKeyboard {
  const rows: InlineKeyboard["inline_keyboard"] = [];
  for (let i = 0; i < CATEGORIES.length; i += 2) {
    rows.push(
      CATEGORIES.slice(i, i + 2).map((c) => ({
        text: (c.key === active ? "• " : "") + c.label,
        callback_data: `c:${id}:${c.key}`,
      })),
    );
  }
  rows.push([
    { text: "Sembunyikan", callback_data: `h:${id}` },
    { text: "Buka di web", url: `${clientEnv.NEXT_PUBLIC_SITE_URL}/b/${id}` },
  ]);
  return { inline_keyboard: rows };
}

export function unhideKeyboard(id: string): InlineKeyboard {
  return { inline_keyboard: [[{ text: "Tampilkan lagi", callback_data: `u:${id}` }]] };
}

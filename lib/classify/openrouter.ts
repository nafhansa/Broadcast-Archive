import "server-only";
import { z } from "zod";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";
import { serverEnv } from "@/lib/env.server";
import { todayJakarta } from "./rules";

const SYSTEM = `Kamu mengklasifikasikan broadcast grup WhatsApp mahasiswa Teknik Informatika ITB (himpunan: HMIF).
Pilih TEPAT SATU kategori dari daftar berikut:
${CATEGORIES.map((c) => `- ${c.key}: ${c.hint}`).join("\n")}
Aturan:
- Magang berbeda dengan loker. Program internship selalu "magang".
- Acara yang diselenggarakan HMIF adalah "proker_hmif", walaupun bentuknya webinar.
- Lomba/hackathon selalu "perlombaan", walaupun dari pihak eksternal.
- Jika ragu, pilih "lainnya".
Buat juga judul singkat bahasa Indonesia maksimal 80 karakter yang menyebut hal pokok (contoh: "Open Recruitment Magang Backend Tokopedia 2027").
Jika ada tenggat pendaftaran/pengumpulan yang jelas, isi deadline format YYYY-MM-DD. Tanggal hari ini: {{TODAY}}. Jika tidak ada, null.
Balas HANYA JSON tanpa teks lain:
{"category":"<key>","title":"<judul>","deadline":"YYYY-MM-DD"|null,"confidence":0..1}`;

export const AiResult = z.object({
  category: z.enum(CATEGORY_KEYS).catch("lainnya"),
  title: z.string().min(3).max(120).transform((s) => s.trim()),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  confidence: z.number().min(0).max(1).catch(0.5),
});
export type AiResult = z.infer<typeof AiResult>;

/** Beberapa model free menaruh teks/penalaran sebelum JSON; ambil blok { ... } terluar. */
export function parseAiContent(content: string): AiResult {
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("no json in model output");
  return AiResult.parse(JSON.parse(json));
}

export class OpenRouterError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function classifyWithAI(body: string, group: string | null) {
  const models = serverEnv.OPENROUTER_MODELS.split(",").map((s) => s.trim()).filter(Boolean);
  const payload: Record<string, unknown> = {
    messages: [
      { role: "system", content: SYSTEM.replace("{{TODAY}}", todayJakarta()) },
      { role: "user", content: `Grup: ${group ?? "-"}\n\n${body.slice(0, 6000)}` },
    ],
    temperature: 0,
    max_tokens: 300,
  };
  if (models.length > 1) payload.models = models;
  else payload.model = models[0];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": serverEnv.NEXT_PUBLIC_SITE_URL,
      "X-Title": "Broadcast Archive",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new OpenRouterError(res.status, `openrouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  return { ...parseAiContent(content), model: data.model as string };
}

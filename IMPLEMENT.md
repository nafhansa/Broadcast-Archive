# Broadcast Archive: Spesifikasi Implementasi E2E (Production)

Dokumen ini adalah instruksi lengkap untuk Claude Code. Implementasikan SEMUA bagian dalam satu kali jalan, tanpa milestone. Jika ada konflik antara dokumen ini dan kebiasaan default, ikuti dokumen ini.

---

## 0. Keputusan arsitektur (baca dulu, ini mengikat)

1. **Telegram webhook TIDAK bisa memakai Server Action.** Server Action hanya bisa dipanggil dari client Next.js (form/`startTransition`), endpoint-nya tidak stabil dan butuh header internal. Telegram mengirim HTTP POST biasa, jadi webhook WAJIB berupa **Route Handler** di `app/api/telegram/route.ts`. Tetap satu deploy di Vercel, tidak ada backend terpisah.
2. **Server Action dipakai untuk semua mutasi dari UI**: login admin, edit broadcast, CRUD Pojok, kirim aspirasi, moderasi.
3. **Klasifikasi AI dijalankan setelah response ke Telegram** memakai `after()` dari `next/server`, supaya webhook membalas 200 cepat dan Telegram tidak retry.
4. **Database: Supabase Postgres.** Semua tulis dari server memakai service role key (server only). Baca publik memakai anon/publishable key dengan RLS.
5. **Kategori ditambah `lainnya`.** Tanpa kategori fallback, model akan memaksa broadcast yang tidak cocok ke kategori yang salah.
6. **Filter 100 karakter dihapus.** Seleksi broadcast dilakukan manusia (owner) saat memilih apa yang di-share ke bot.

### Alur end-to-end

```
WhatsApp (long press pesan) -> Share -> Telegram -> chat dengan bot
  -> Telegram POST /api/telegram (header secret)
  -> verifikasi secret + owner id + idempotensi update_id
  -> parse header "#grup | pengirim", ekstrak link, hitung hash
  -> simpan broadcast (category='lainnya', category_source='rule' + klasifikasi rule-based dulu)
  -> balas 200 ke Telegram
  -> after(): panggil OpenRouter (free model) -> update category, title, deadline
  -> bot kirim pesan konfirmasi + inline keyboard untuk ganti kategori / sembunyikan
Website publik: / (feed), /b/[id] (detail), /aspirasi, /aspirasi/[slug]
Admin: /admin-login, /admin/broadcasts, /admin/aspirasi
```

---

## 1. Stack dan dependency

- Next.js versi stabil terbaru, App Router, TypeScript strict, React Server Components default.
- Tailwind CSS v4.
- `@supabase/supabase-js`, `@supabase/ssr`.
- `zod` untuk validasi semua input.
- `date-fns` dengan locale `id`.
- `geist` (font Geist Sans dan Geist Mono via `next/font`).
- `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-toast` (primitif saja, di-style sendiri). Jangan pakai template shadcn mentah tanpa restyle.
- Ikon: `lucide-react`, stroke 1.75, ukuran 18. DILARANG ikon `Sparkles`, `Wand`, `Bot` untuk dekorasi.
- Tidak ada library word cloud. Cloud dibuat sendiri (lihat bagian 9).

Package manager: pnpm.

---

## 2. Environment variables

`.env.local` (dan di Vercel Project Settings > Environment Variables, scope Production + Preview):

```bash
NEXT_PUBLIC_SITE_URL=https://broadcast-archive.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=          # atau publishable key
SUPABASE_SERVICE_ROLE_KEY=              # atau secret key. SERVER ONLY. Jangan pernah prefix NEXT_PUBLIC_

TELEGRAM_BOT_TOKEN=                     # dari @BotFather
TELEGRAM_WEBHOOK_SECRET=                # openssl rand -hex 32
TELEGRAM_OWNER_ID=                      # user id Telegram kamu (angka)

OPENROUTER_API_KEY=
OPENROUTER_MODELS=openrouter/free       # comma separated, urutan prioritas. contoh: openrouter/free,google/gemma-3-12b-it:free

IP_HASH_SALT=                           # openssl rand -hex 32, untuk hash IP anonim aspirasi
CRON_SECRET=                            # openssl rand -hex 32
```

Buat `lib/env.ts` yang memvalidasi semua env dengan zod saat import, dan pisahkan `serverEnv` (tidak boleh diimport dari client component, tambahkan `import "server-only"`).

---

## 3. Struktur folder

```
app/
  layout.tsx
  globals.css
  page.tsx                       # feed publik
  b/[id]/page.tsx                # detail broadcast
  aspirasi/page.tsx              # daftar pojok
  aspirasi/[slug]/page.tsx       # satu pojok: cloud + form + list
  aspirasi/actions.ts            # server action submitAspiration
  admin-login/page.tsx
  admin-login/actions.ts         # signIn
  admin/layout.tsx               # guard + shell admin
  admin/page.tsx                 # redirect ke /admin/broadcasts
  admin/broadcasts/page.tsx
  admin/broadcasts/[id]/page.tsx
  admin/aspirasi/page.tsx
  admin/aspirasi/[id]/page.tsx
  admin/actions.ts               # semua server action admin
  api/telegram/route.ts          # webhook
  api/cron/keepalive/route.ts    # cegah Supabase pause
  not-found.tsx
  error.tsx
components/
  broadcast/BroadcastCard.tsx
  broadcast/LinkButtons.tsx
  broadcast/CategoryChips.tsx
  broadcast/CategoryTag.tsx
  broadcast/SearchBar.tsx
  broadcast/FeedList.tsx         # client, load more
  broadcast/DeadlineRail.tsx
  aspirasi/WordCloud.tsx         # client, realtime
  aspirasi/AspirationForm.tsx
  aspirasi/AspirationList.tsx
  admin/...                      # tabel, form edit, dialog konfirmasi
  ui/...                         # Button, Input, Textarea, Select, Badge, Dialog, Toast, Skeleton
lib/
  env.ts
  categories.ts
  supabase/server.ts             # createServerClient (cookies) untuk RSC & actions
  supabase/admin.ts              # service role client, server-only
  supabase/browser.ts            # untuk realtime di client
  auth.ts                        # requireAdmin()
  telegram/api.ts                # sendMessage, answerCallbackQuery, editMessageText, getFile
  telegram/parse.ts              # parseHeader, extractLinks, labelFor
  telegram/keyboard.ts           # inline keyboard kategori
  ingest.ts                      # createBroadcastFromMessage
  classify/openrouter.ts
  classify/rules.ts
  classify/index.ts
  aspirasi/normalize.ts
  moderation.ts                  # blocklist kata
  hash.ts                        # sha256
middleware.ts                    # (Next 16: proxy.ts) refresh session + guard /admin
supabase/migrations/0001_init.sql
vercel.json
```

---

## 4. Design system

### 4.1 Arah visual

Tema hijau putih. Warna aksen kedua diambil dari logo: **sand/beige** (cincin dan blok kecil di logo). Bentuk diambil dari logo: **kotak dengan radius besar dan celah konsisten**, dan **titik bercincin** sebagai penanda.

Logo yang diberikan berwarna biru. Biru tidak masuk palet UI. Tampilkan logo apa adanya hanya di header (ukuran kecil, 28px tinggi) dan di halaman login. Siapkan juga varian monokrom hijau `public/logo-mark-green.svg` jika owner menyediakannya; komponen `Logo` harus mendukung prop `variant="original" | "green"`.

### 4.2 Token warna (taruh di `globals.css`, Tailwind v4 `@theme`)

```css
@theme {
  --color-bg: #F7F8F5;          /* putih hangat, sedikit hijau */
  --color-surface: #FFFFFF;
  --color-ink: #0F2318;         /* teks utama */
  --color-ink-2: #3D5246;       /* teks sekunder */
  --color-muted: #6B7C72;       /* meta */
  --color-line: #E2E8E3;        /* border */
  --color-line-strong: #CBD6CE;

  --color-green-950: #0A2A1B;
  --color-green-800: #0F4D30;
  --color-green-700: #136A40;   /* PRIMARY */
  --color-green-600: #198754;
  --color-green-500: #22A866;
  --color-green-100: #E2F3E8;
  --color-green-50:  #F1F9F4;

  --color-sand: #E8DCCB;        /* dari logo */
  --color-sand-2: #C9BBA7;
  --color-sand-ink: #6E604E;

  --color-danger: #B42318;
  --color-danger-bg: #FDECEA;
  --color-warn: #9A6700;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;            /* kartu, meniru kotak logo */

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

Mode gelap: TIDAK diimplementasikan (scope). Jangan tambahkan toggle.

### 4.3 Warna kategori

Semua kategori memakai tag netral (background `surface`, border `line`) dengan **kotak kecil 8x8 radius 2px** berwarna sebagai penanda. Jangan warnai seluruh tag dengan warna terang.

| key | label | warna kotak |
|---|---|---|
| magang | Magang | #136A40 |
| loker | Loker | #0F4D30 |
| akademik | Akademik | #3E7CB1 |
| proker_hmif | Proker HMIF | #22A866 |
| kegiatan_angkatan | Kegiatan Angkatan | #C9BBA7 |
| kegiatan_eksternal | Kegiatan External | #8A6D3B |
| perlombaan | Perlombaan | #B5562B |
| merch | Merch | #7A5BA6 |
| beasiswa | Beasiswa | #9A6700 |
| lainnya | Lainnya | #9AA59F |

Definisikan di `lib/categories.ts` sebagai satu sumber kebenaran:

```ts
export const CATEGORIES = [
  { key: "magang", label: "Magang", color: "#136A40", hint: "lowongan internship, program magang perusahaan/startup/lab" },
  { key: "loker", label: "Loker", color: "#0F4D30", hint: "lowongan kerja full-time/part-time/freelance, bukan magang" },
  { key: "akademik", label: "Akademik", color: "#3E7CB1", hint: "kuliah, jadwal kelas, ujian, nilai, tugas, dosen, prodi, perwalian, KRS, wisuda" },
  { key: "proker_hmif", label: "Proker HMIF", color: "#22A866", hint: "program kerja atau kegiatan yang diselenggarakan HMIF ITB" },
  { key: "kegiatan_angkatan", label: "Kegiatan Angkatan", color: "#C9BBA7", hint: "acara internal satu angkatan: makrab, bukber, foto angkatan, iuran angkatan" },
  { key: "kegiatan_eksternal", label: "Kegiatan External", color: "#8A6D3B", hint: "acara dari luar HMIF: webinar, seminar, workshop, event unit/kampus lain, perusahaan" },
  { key: "perlombaan", label: "Perlombaan", color: "#B5562B", hint: "lomba, kompetisi, hackathon, CTF, call for team" },
  { key: "merch", label: "Merch", color: "#7A5BA6", hint: "penjualan merchandise, PO jaket/kaos/stiker, danusan" },
  { key: "beasiswa", label: "Beasiswa", color: "#9A6700", hint: "beasiswa, bantuan dana pendidikan, pendaftaran beasiswa" },
  { key: "lainnya", label: "Lainnya", color: "#9AA59F", hint: "tidak cocok dengan kategori lain" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [CategoryKey, ...CategoryKey[]];
export const categoryOf = (k: string) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[9];
```

### 4.4 Tipografi

- Geist Sans untuk semua teks. Geist Mono untuk meta (waktu, nama grup, hitungan, ID).
- Skala: 13 (meta), 15 (body mobile), 16 (body desktop), 17 semibold (judul kartu), 22 (judul halaman mobile), 28 (judul halaman desktop). Line-height body 1.6.
- `font-variant-numeric: tabular-nums` untuk angka.

### 4.5 Aturan anti AI slop (WAJIB)

- Tidak ada hero section besar dengan tagline di tengah. Halaman utama langsung menampilkan feed.
- Tidak ada gradient ungu/biru, glassmorphism, blur backdrop dekoratif, glow, atau shadow besar. Shadow maksimal `0 1px 2px rgba(15,35,24,.06)`.
- Tidak ada emoji di UI.
- Tidak ada teks generik seperti "Welcome to", "Unlock", "Seamless", "Powered by AI". Indikator hasil AI cukup teks kecil "otomatis" di admin.
- Satu warna aksen aktif per layar (hijau). Sand hanya untuk penanda sekunder (titik bercincin, garis aktif, highlight cloud).
- Border 1px `line` untuk memisahkan, bukan kartu mengambang.
- Empty state menjelaskan kondisi nyata ("Belum ada broadcast di kategori Beasiswa"), bukan ilustrasi.
- Loading memakai skeleton dengan bentuk kartu yang sama, bukan spinner.
- Motion: hanya transisi 150ms untuk hover/press dan animasi pertumbuhan kata di cloud. Hormati `prefers-reduced-motion`.

### 4.6 Elemen tanda tangan (dari logo)

- **Titik bercincin**: lingkaran 10px hijau-950 dengan ring 3px sand. Dipakai sebagai indikator "baru" (broadcast < 24 jam) dan indikator "live" di Pojok Aspirasi.
- **Grid kotak**: header memakai logo; tidak ada pola dekoratif lain.

### 4.7 Komponen dasar

- Button primary: bg green-700, teks putih, radius md, tinggi 44 (mobile) / 40 (desktop), active bg green-800.
- Button secondary: bg surface, border line-strong, teks ink.
- Button link (tombol link di broadcast): bg green-50, border green-100, teks green-800, ikon `ExternalLink` di kanan, tinggi 44, lebar penuh di mobile.
- Input/Textarea: border line-strong, focus ring 2px green-500 offset 1.
- Semua target sentuh minimal 44x44.

---

## 5. Database (Supabase)

Simpan sebagai `supabase/migrations/0001_init.sql`, jalankan di SQL Editor Supabase.

```sql
create extension if not exists pg_trgm;

-- ENUMS
create type broadcast_category as enum (
  'magang','loker','akademik','proker_hmif','kegiatan_angkatan',
  'kegiatan_eksternal','perlombaan','merch','beasiswa','lainnya'
);
create type broadcast_status as enum ('published','hidden');
create type category_source as enum ('rule','ai','manual');

-- ADMINS
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- BROADCASTS
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category broadcast_category not null default 'lainnya',
  category_source category_source not null default 'rule',
  ai_model text,
  ai_confidence real,
  links jsonb not null default '[]'::jsonb,      -- [{url,label,kind}]
  media jsonb not null default '[]'::jsonb,      -- [{path,url,width,height,mime}]
  source_group text,
  sender text,
  deadline date,
  status broadcast_status not null default 'published',
  pinned boolean not null default false,
  content_hash text not null unique,
  tg_chat_id bigint,
  tg_message_ids bigint[] not null default '{}',
  tg_confirm_message_id bigint,                  -- id pesan konfirmasi bot, untuk edit keyboard
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(source_group,'') || ' ' || coalesce(sender,'')), 'C')
  ) stored
);
create index broadcasts_search_idx on public.broadcasts using gin (search);
create index broadcasts_feed_idx on public.broadcasts (status, pinned desc, received_at desc);
create index broadcasts_cat_idx on public.broadcasts (category, received_at desc);
create index broadcasts_body_trgm on public.broadcasts using gin (body gin_trgm_ops);
create index broadcasts_deadline_idx on public.broadcasts (deadline) where deadline is not null;

-- TELEGRAM UPDATE LOG (idempotensi + /undo + gabung pesan terpecah)
create table public.tg_updates (
  update_id bigint primary key,
  chat_id bigint not null,
  message_id bigint,
  broadcast_id uuid references public.broadcasts(id) on delete set null,
  text_len int not null default 0,
  created_at timestamptz not null default now()
);
create index tg_updates_chat_idx on public.tg_updates (chat_id, created_at desc);

-- POJOK ASPIRASI
create table public.pojok (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  question text not null,
  description text,
  is_open boolean not null default true,      -- menerima jawaban baru
  is_visible boolean not null default true,   -- tampil di publik
  max_length int not null default 80 check (max_length between 10 and 280),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.aspirations (
  id uuid primary key default gen_random_uuid(),
  pojok_id uuid not null references public.pojok(id) on delete cascade,
  text text not null,
  normalized text not null,
  status text not null default 'visible' check (status in ('visible','hidden')),
  auto_flagged boolean not null default false,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (pojok_id, ip_hash, normalized)       -- satu orang tidak bisa membesarkan kata yang sama
);
create index aspirations_pojok_idx on public.aspirations (pojok_id, created_at desc);
create index aspirations_norm_idx on public.aspirations (pojok_id, normalized);
create index aspirations_ip_idx on public.aspirations (ip_hash, created_at desc);

create view public.pojok_cloud with (security_invoker = true) as
select pojok_id,
       normalized,
       (array_agg(text order by created_at desc))[1] as display_text,
       count(*)::int as n,
       max(created_at) as last_at
from public.aspirations
where status = 'visible'
group by pojok_id, normalized;

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger broadcasts_touch before update on public.broadcasts for each row execute function public.touch_updated_at();
create trigger pojok_touch before update on public.pojok for each row execute function public.touch_updated_at();

-- RLS
alter table public.admins enable row level security;
alter table public.broadcasts enable row level security;
alter table public.tg_updates enable row level security;
alter table public.pojok enable row level security;
alter table public.aspirations enable row level security;

create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());

create policy broadcasts_read on public.broadcasts for select
  using (status = 'published' or public.is_admin());
create policy broadcasts_admin_write on public.broadcasts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tg_updates: tidak ada policy publik, hanya service role

create policy pojok_read on public.pojok for select
  using (is_visible or public.is_admin());
create policy pojok_admin_write on public.pojok for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy aspirations_read on public.aspirations for select
  using (
    (status = 'visible' and exists (select 1 from public.pojok p where p.id = pojok_id and p.is_visible))
    or public.is_admin()
  );
create policy aspirations_admin_write on public.aspirations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- INSERT publik tidak lewat RLS; dilakukan di server action dengan service role setelah rate limit.

-- Kolom ip_hash tidak boleh terbaca publik
revoke select (ip_hash) on public.aspirations from anon;
grant select (id, pojok_id, text, normalized, status, auto_flagged, created_at) on public.aspirations to anon;

-- Realtime untuk cloud live
alter publication supabase_realtime add table public.aspirations;
```

Catatan untuk Claude Code: jika `revoke select (ip_hash)` bentrok dengan grant default tabel, lakukan `revoke select on public.aspirations from anon;` lalu grant per kolom seperti di atas. Pastikan query publik tidak pernah memakai `select *` pada `aspirations`.

### Storage

Buat bucket publik `broadcast-media`. Hanya service role yang upload. Path: `broadcasts/{broadcast_id}/{file_unique_id}.{ext}`.

---

## 6. Webhook Telegram

### 6.1 `lib/telegram/api.ts`

Fungsi tipis di atas `fetch("https://api.telegram.org/bot${TOKEN}/<method>")`:
`sendMessage(chatId, text, opts?)`, `editMessageText(chatId, messageId, text, replyMarkup?)`, `editMessageReplyMarkup`, `answerCallbackQuery(id, text?)`, `getFile(fileId)`, `downloadFile(filePath): ArrayBuffer`.
Selalu `parse_mode` tidak dipakai (plain text) untuk menghindari error escaping. Timeout 8 detik via `AbortSignal.timeout`.

### 6.2 `lib/telegram/parse.ts`

```ts
export type ParsedHeader = { group: string | null; sender: string | null; body: string };

// Baris pertama opsional: "#Nama Grup | Nama Pengirim"
const HEADER = /^#([^|\n]+?)\s*(?:\|\s*([^\n]+?))?\s*\n+([\s\S]+)$/;

export function parseHeader(raw: string): ParsedHeader {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const m = text.match(HEADER);
  if (!m) return { group: null, sender: null, body: text };
  return { group: m[1].trim() || null, sender: m[2]?.trim() || null, body: m[3].trim() };
}

export type LinkItem = { url: string; label: string; kind: LinkKind };
export type LinkKind = "form" | "drive" | "instagram" | "whatsapp" | "zoom" | "meet" | "youtube" | "linkedin" | "web";

type TgEntity = { type: string; offset: number; length: number; url?: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+|\b(?:bit\.ly|s\.id|forms\.gle|linktr\.ee|wa\.me|tinyurl\.com|lnkd\.in)\/[^\s<>"'`]+/gi;

export function normalizeUrl(u: string): string | null {
  let s = u.trim().replace(/[.,;:!?)\]}>"']+$/g, "");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const url = new URL(s);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch { return null; }
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

export function labelFor(url: string): { label: string; kind: LinkKind } {
  const h = new URL(url).hostname.replace(/^www\./, "");
  const p = new URL(url).pathname;
  if (h === "forms.gle" || (h === "docs.google.com" && p.startsWith("/forms"))) return { label: "Isi Form", kind: "form" };
  if (h === "drive.google.com" || (h === "docs.google.com")) return { label: "Buka Dokumen", kind: "drive" };
  if (h.endsWith("instagram.com")) return { label: "Lihat Instagram", kind: "instagram" };
  if (h === "wa.me" || h.endsWith("whatsapp.com")) return { label: "Chat WhatsApp", kind: "whatsapp" };
  if (h.endsWith("zoom.us")) return { label: "Join Zoom", kind: "zoom" };
  if (h === "meet.google.com") return { label: "Join Meet", kind: "meet" };
  if (h.endsWith("youtube.com") || h === "youtu.be") return { label: "Tonton", kind: "youtube" };
  if (h.endsWith("linkedin.com") || h === "lnkd.in") return { label: "Buka LinkedIn", kind: "linkedin" };
  return { label: h, kind: "web" };
}

export function makeTitleFallback(body: string): string {
  const first = body.split("\n").map((l) => l.replace(/[*_~`#>]+/g, "").trim()).find((l) => l.length >= 4) ?? body;
  return first.length > 90 ? first.slice(0, 87).trimEnd() + "..." : first;
}
```

### 6.3 `lib/hash.ts`

`sha256(text)` memakai `crypto.subtle`. `contentHash(body)` = sha256 dari body yang dinormalisasi: lowercase, hapus semua whitespace berlebih, hapus karakter `*_~`.

### 6.4 `lib/ingest.ts`

`createBroadcastFromMessage(msg, updateId)`:

1. Ambil `raw = msg.text ?? msg.caption ?? ""`, `entities = msg.entities ?? msg.caption_entities ?? []`.
2. **Gabung pesan terpecah**: Telegram memecah teks > 4096 karakter menjadi beberapa pesan. Cari baris `tg_updates` terakhir dari `chat_id` yang sama dengan `created_at` dalam 20 detik terakhir dan `text_len >= 3500` dan `broadcast_id` tidak null. Jika ada, append `"\n" + raw` ke body broadcast itu, update `links`, `content_hash`, `tg_message_ids`, lalu jalankan ulang klasifikasi. Selesai.
3. Jika tidak: `parseHeader(raw)`, `extractLinks`, `contentHash`.
4. Jika ada `msg.photo`: ambil ukuran terbesar, `getFile`, download, upload ke storage, isi `media`. Jika ada `msg.document` dengan mime `image/*` atau `application/pdf` dan size <= 20MB, perlakukan sama. Gagal upload tidak boleh menggagalkan ingest; log saja.
5. Klasifikasi rule-based sinkron (`classifyByRules`) untuk nilai awal.
6. `insert ... on conflict (content_hash) do nothing returning id`. Jika konflik, ambil id yang sudah ada dan kembalikan `{ duplicate: true, id }`.
7. Isi `tg_updates.broadcast_id`.

### 6.5 `app/api/telegram/route.ts`

```ts
import { after, NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== serverEnv.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const update = await req.json().catch(() => null);
  if (!update?.update_id) return NextResponse.json({ ok: true });

  const db = supabaseAdmin();
  // Idempotensi: Telegram bisa mengirim ulang update yang sama
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? 0;
  const { error: dupErr } = await db.from("tg_updates").insert({
    update_id: update.update_id, chat_id: chatId,
    message_id: update.message?.message_id ?? null,
    text_len: (update.message?.text ?? update.message?.caption ?? "").length,
  });
  if (dupErr?.code === "23505") return NextResponse.json({ ok: true });

  try {
    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message) await handleMessage(update.message, update.update_id);
  } catch (e) {
    console.error("telegram handler", e);
  }
  return NextResponse.json({ ok: true }); // SELALU 200
}
```

`handleMessage(msg, updateId)`:

- Jika `msg.chat.type !== "private"`: abaikan.
- Jika teks `/start`: balas `ID Telegram kamu: <from.id>. Status: owner / bukan owner.` (boleh untuk siapa saja, ini cara owner mengetahui ID-nya).
- Jika `from.id !== TELEGRAM_OWNER_ID`: balas sekali "Bot ini privat." lalu return.
- Perintah owner:
  - `/undo`: sembunyikan (status `hidden`) broadcast terakhir yang dibuat dari chat ini, balas "Disembunyikan: <title>".
  - `/last`: tampilkan 5 broadcast terakhir (judul + kategori + link `/b/<id>`).
  - `/help`: daftar perintah dan format header.
- Selain perintah: panggil `createBroadcastFromMessage`.
  - Jika teks kosong dan tidak ada media: balas "Tidak ada teks untuk disimpan."
  - Jika duplikat: balas "Sudah ada di arsip: <SITE_URL>/b/<id>".
  - Jika baru: kirim pesan konfirmasi:
    ```
    Tersimpan
    <title>
    Kategori: <label> (sementara, menunggu klasifikasi)
    <SITE_URL>/b/<id>
    ```
    dengan inline keyboard kategori (6.6). Simpan `message_id` hasil `sendMessage` ke `broadcasts.tg_confirm_message_id`.
  - Daftarkan `after(() => classifyAndUpdate(id))`. Setelah klasifikasi selesai, `editMessageText` pesan konfirmasi dengan kategori final (tanpa kata "sementara") dan judul hasil AI, keyboard tetap ada. Jika owner sudah menekan tombol kategori sebelum AI selesai (`category_source = 'manual'`), AI TIDAK boleh menimpa kategori.

### 6.6 Inline keyboard (`lib/telegram/keyboard.ts`)

- 10 tombol kategori dalam 2 kolom. Kategori aktif diberi awalan "• ".
- Baris terakhir: `Sembunyikan` dan `Buka di web` (url button ke `/b/<id>`).
- `callback_data`: `c:<uuid>:<categoryKey>` dan `h:<uuid>` (maks 64 byte, uuid 36 karakter aman).

`handleCallback(cq)`:
- Tolak jika `cq.from.id !== OWNER` (answerCallbackQuery "Bukan owner").
- `c:` update `category`, set `category_source = 'manual'`, edit keyboard, answer "Kategori: <label>".
- `h:` set `status = 'hidden'`, edit teks menjadi "Disembunyikan", keyboard berisi tombol `Tampilkan lagi` (`u:<uuid>`).
- `u:` set `status = 'published'`.

---

## 7. Klasifikasi

### 7.1 Fakta batas OpenRouter free

Model gratis (ID berakhiran `:free`, atau router `openrouter/free`) dibatasi 20 request/menit dan 50 request/hari untuk akun yang belum pernah membeli kredit, naik ke 1.000/hari setelah sekali membeli kredit minimal $10. Model gratis juga bisa hilang dari katalog tanpa pemberitahuan. Karena itu:

- Daftar model dibaca dari env `OPENROUTER_MODELS` (comma separated). Jika lebih dari satu, kirim sebagai array `models` (fallback otomatis OpenRouter). Jika satu, kirim sebagai `model`.
- Satu broadcast = satu request. Re-klasifikasi dari admin juga satu request.
- Selalu ada fallback rule-based. Sistem harus tetap berfungsi penuh tanpa AI.

### 7.2 `lib/classify/rules.ts`

Kamus kata kunci per kategori (lowercase, cocokkan dengan `\b` atau `includes` setelah normalisasi). Skor = jumlah kecocokan, judul dihitung 2x. Kategori skor tertinggi menang; jika semua 0 maka `lainnya`. Kata kunci minimum:

- magang: magang, internship, intern, mbkm, kampus merdeka, msib, summer program
- loker: lowongan kerja, loker, hiring, we are hiring, full time, part time, freelance, job opening, vacancy, rekrutmen karyawan
- akademik: kuliah, kelas, uts, uas, quiz, kuis, tugas, dosen, asisten, praktikum, krs, perwalian, nilai, jadwal, prodi, sidang, wisuda, tpb, six
- proker_hmif: hmif, himpunan, kahim, badan pengurus, bp hmif, open recruitment hmif, proker
- kegiatan_angkatan: angkatan, makrab, bukber, foto angkatan, iuran angkatan, kumpul angkatan, ketua angkatan
- kegiatan_eksternal: webinar, seminar, workshop, talkshow, bootcamp, open house, career fair, unit, kabinet km itb
- perlombaan: lomba, kompetisi, competition, hackathon, ctf, cari tim, call for team, juara, olimpiade, gemastik
- merch: merch, merchandise, pre order, preorder, po , jaket, kaos, hoodie, totebag, stiker, danus
- beasiswa: beasiswa, scholarship, bantuan dana, lpdp, djarum, bca finance, kip

Juga ekstrak deadline sederhana dengan regex tanggal Indonesia (`\d{1,2}\s(jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des)[a-z]*\s?\d{0,4}`) dan `\d{1,2}/\d{1,2}/\d{2,4}`; ambil tanggal terdekat di masa depan setelah kata "deadline", "batas", "paling lambat", "ditutup", "close", "sebelum". Tahun yang tidak ditulis = tahun berjalan, atau tahun depan jika tanggal sudah lewat lebih dari 30 hari.

### 7.3 `lib/classify/openrouter.ts`

```ts
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
  if (models.length > 1) payload.models = models; else payload.model = models[0];

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
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  const parsed = AiResult.parse(JSON.parse(json ?? "{}"));
  return { ...parsed, model: data.model as string };
}

const AiResult = z.object({
  category: z.enum(CATEGORY_KEYS).catch("lainnya"),
  title: z.string().min(3).max(120).transform((s) => s.trim()),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  confidence: z.number().min(0).max(1).catch(0.5),
});
```

Beberapa model free memasukkan blok penalaran atau teks sebelum JSON; regex `\{[\s\S]*\}` mengatasinya. Jika parse gagal, anggap error.

### 7.4 `lib/classify/index.ts`

`classifyAndUpdate(broadcastId)`:
1. Ambil broadcast. Jika `category_source = 'manual'`, hanya update `title` dan `deadline` jika masih hasil fallback; jangan sentuh kategori.
2. Coba `classifyWithAI`. Retry 1x jika status 429/5xx dengan jeda 3 detik.
3. Sukses: update `category`, `category_source='ai'`, `ai_model`, `ai_confidence`, `title`, `deadline` (jangan timpa deadline jika AI null tapi rule menemukan).
4. Gagal: biarkan hasil rule, log error.
5. Edit pesan konfirmasi Telegram.

Server action admin `reclassifyBroadcast(id)` memanggil fungsi yang sama dengan opsi `force: true` (boleh menimpa kategori manual).

---

## 8. Halaman publik

Semua halaman publik adalah RSC dengan `revalidate = 60`, kecuali bagian interaktif (client component kecil). Setelah ingest atau edit admin, panggil `revalidatePath("/")` dan `revalidatePath("/b/<id>")`.

### 8.1 Layout umum

- Header 56px, sticky, bg `surface`, border bawah `line`. Kiri: logo (tinggi 28) + teks "Broadcast Archive" semibold 15. Kanan: link `Arsip` dan `Pojok Aspirasi` (desktop); di mobile menjadi dua tab teks di bawah header (bukan hamburger), tinggi 44, garis aktif 2px green-700.
- Kontainer: padding 16 mobile, max-width 1200 desktop.
- Footer minimal: teks muted "Arsip broadcast angkatan. Isi broadcast milik pengirim aslinya." Tanpa logo besar.

### 8.2 `/` Feed

Query param: `?cat=<key>&q=<text>&cursor=<received_at>_<id>`.

Mobile (< 768):
- Search bar penuh di atas (input 44px, ikon Search kiri, tombol clear).
- Category chips: satu baris horizontal scroll, sticky di bawah header. Chip pertama "Semua". Chip aktif: bg green-700 teks putih. Chip lain: border line, kotak warna kategori 8px di kiri. Tampilkan jumlah per kategori dalam mono kecil.
- Daftar kartu.

Desktop (>= 1024):
- Grid 3 kolom: sidebar kiri 232px (daftar kategori vertikal dengan jumlah, sticky), feed tengah max 680px, rail kanan 280px "Tenggat terdekat" (broadcast published dengan deadline >= hari ini, urut naik, maks 6, tiap item: tanggal mono besar di kiri "28 OKT", judul 2 baris). Rail kanan hilang di 768 sampai 1023, sidebar berubah jadi chips.

Kartu broadcast (`BroadcastCard`):
- Border 1px `line`, radius lg, padding 16, bg surface. Tidak ada shadow.
- Baris 1: `CategoryTag` + jika `received_at` < 24 jam, titik bercincin + teks "baru". Kanan: waktu relatif mono 13 ("2 jam lalu", >7 hari jadi "12 Okt 2026").
- Judul 17 semibold, maks 2 baris.
- Excerpt body 15, `line-clamp-3`, warna ink-2, whitespace dipertahankan.
- Jika ada deadline: baris "Tenggat 28 Okt" dengan warna warn jika <= 3 hari lagi, danger jika lewat.
- Jika ada media gambar: thumbnail 72x72 radius md di kanan judul.
- `LinkButtons` mode ringkas: tampilkan maks 2 tombol link (label dari `labelFor`), sisanya "+N link". Di mobile tombol lebar penuh bertumpuk; di desktop inline.
- Seluruh kartu bisa diklik ke `/b/<id>` KECUALI tombol link (stopPropagation, buka tab baru `rel="noopener noreferrer"`).
- Pinned: label kecil "Disematkan" di baris 1, kartu pinned selalu di atas pada view "Semua".

Pagination: tombol "Muat lebih banyak" (bukan infinite scroll otomatis), 20 per halaman, cursor-based.

Search: `websearch_to_tsquery('simple', q)` pada kolom `search`; jika hasil 0 dan q >= 3 karakter, fallback `body ilike '%q%'`. Debounce 300ms di client, update URL dengan `router.replace`.

### 8.3 `/b/[id]` Detail

- Tombol kembali (ikon + "Arsip") di kiri atas.
- Tag kategori, judul 22/28, meta mono: grup, pengirim, tanggal lengkap ("Sabtu, 24 Okt 2026 20.38 WIB").
- Body penuh: pertahankan baris baru, ubah `*teks*` jadi bold dan `_teks_` jadi italic (format WhatsApp), URL di dalam teks jadi link underline green-700. Escape HTML; jangan pakai `dangerouslySetInnerHTML` dengan input mentah. Render dengan tokenizer sederhana menjadi elemen React.
- Media: gambar full width radius lg, klik untuk buka ukuran penuh. PDF tampil sebagai baris file dengan tombol "Buka PDF".
- Link: semua tombol link (bukan ringkas). Di mobile, jika ada link, **bar bawah sticky** berisi tombol link utama (link pertama) + tombol "Salin teks". Di desktop, tombol ada di bawah body.
- Tombol "Salin teks" (copy body ke clipboard, toast "Tersalin") dan "Bagikan" (Web Share API, fallback salin URL).
- Metadata OpenGraph: title = judul, description = 160 karakter pertama body.
- 404 jika tidak ada atau hidden (untuk non-admin).

### 8.4 `/aspirasi`

- Judul "Pojok Aspirasi", subjudul satu kalimat: "Tulis aspirasimu tanpa login. Jawaban yang sama akan tampil makin besar."
- Daftar pojok visible urut `sort_order`, lalu terbaru. Tiap item: kartu dengan judul, pertanyaan, jumlah jawaban (mono), status "Dibuka" (titik bercincin) atau "Ditutup" (muted).

### 8.5 `/aspirasi/[slug]`

Urutan section:
1. Judul pojok + pertanyaan (besar, 22/28) + deskripsi.
2. **Word cloud** (bagian 9) di dalam panel border `line` radius lg, tinggi min 280 mobile / 380 desktop. Indikator "live" titik bercincin di pojok kanan atas.
3. **Form** (jika `is_open`): textarea 1 baris auto-grow, placeholder "Tulis singkat, misal: perpanjang jam lab", counter `n/max_length` mono, tombol "Kirim". Setelah kirim: textarea kosong, toast "Terkirim", kata langsung muncul (optimistic) di cloud. Jika ditutup: teks "Pojok ini sudah ditutup."
4. **Daftar aspirasi**: urut terbaru, 30 per halaman dengan "Muat lebih banyak". Tiap item: teks, waktu relatif mono. Opsi toggle "Terbaru / Terbanyak" (Terbanyak = dikelompokkan per normalized dengan badge jumlah).

---

## 9. Word cloud ala Mentimeter

### 9.1 Normalisasi (`lib/aspirasi/normalize.ts`)

```ts
export function normalizeAspiration(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "") // emoji
    .replace(/[^\p{L}\p{N}\s]/gu, " ")                       // tanda baca
    .replace(/\s+/g, " ")
    .trim();
}
```

"Jam Lab diperpanjang!!" dan "jam lab diperpanjang" dihitung sama. Ini pencocokan persis setelah normalisasi; jawaban panjang jarang sama, karena itu `max_length` default 80 dan placeholder mengarahkan ke jawaban singkat.

### 9.2 Data

- Server: ambil `pojok_cloud` untuk pojok tersebut, urut `n desc`, maks 80 entri.
- Client (`WordCloud.tsx`): subscribe Supabase Realtime `postgres_changes` INSERT/UPDATE/DELETE pada `aspirations` filter `pojok_id=eq.<id>`. Pada INSERT visible: tambah n untuk normalized itu (atau buat entri baru). Pada UPDATE ke hidden atau DELETE: kurangi. Debounce render 150ms.

### 9.3 Layout dan ukuran

- Ukuran font: `size = minPx + (maxPx - minPx) * sqrt((n - 1) / (maxN - 1))`; minPx 14, maxPx 56 desktop / 40 mobile. Jika maxN = 1 semua 18px.
- Berat font: n teratas (top 3) weight 700, lainnya 500.
- Warna: top 1 green-800, top 2 sampai 5 green-700, sisanya bergantian green-600 dan sand-ink. Tanpa warna acak pelangi.
- Susunan: flex-wrap rata tengah, gap 8 sampai 14. Urutan deterministik "spiral sederhana": entri terbesar di tengah array, lalu bergantian kiri dan kanan berdasarkan peringkat (rank 0 di tengah, rank 1 kanan, rank 2 kiri, dst), sehingga kata besar berkumpul di tengah.
- Animasi: saat n bertambah, transisi `font-size` 300ms ease-out dan flash background sand 600ms pada kata tersebut. Kata baru masuk dengan fade + scale dari 0.9. Nonaktifkan dengan `prefers-reduced-motion`.
- Tooltip / title attribute: "<n> orang".
- Klik kata: scroll ke daftar dan filter daftar ke normalized tersebut (chip filter yang bisa dihapus).

---

## 10. Anti spam dan moderasi aspirasi

Server action `submitAspiration(slug, text, honeypot)` di `app/aspirasi/actions.ts`:

1. Validasi zod: text 2 sampai `max_length` karakter setelah trim; honeypot harus kosong (field tersembunyi `website`).
2. Pojok harus `is_visible && is_open`.
3. IP dari header `x-forwarded-for` (ambil pertama) atau `x-real-ip`. `ip_hash = sha256(IP_HASH_SALT + ip + pojok_id)`. IP mentah TIDAK disimpan.
4. Rate limit via query: maks 5 kiriman per `ip_hash` per 10 menit, maks 1 per 10 detik. Jika lewat: kembalikan error "Terlalu cepat, coba lagi sebentar."
5. `normalized = normalizeAspiration(text)`; jika kosong tolak.
6. Moderasi otomatis `lib/moderation.ts`: daftar kata kasar/SARA bahasa Indonesia dan Inggris (array yang bisa diedit, cocokkan per token dan dengan normalisasi leetspeak sederhana `4->a, 1->i, 0->o, 3->e, 5->s`). Jika cocok: simpan dengan `status='hidden', auto_flagged=true`, tetapi tetap balas sukses ke pengirim (jangan beri sinyal ke spammer).
7. Insert pakai service role. Jika melanggar unique `(pojok_id, ip_hash, normalized)`: balas "Kamu sudah mengirim jawaban ini." Ini mencegah satu orang membesarkan kata yang sama.
8. `revalidatePath("/aspirasi/" + slug)`.

Batasan yang harus diterima: hash IP bisa dihindari dengan ganti jaringan. Untuk acara besar, admin bisa menutup pojok (`is_open=false`) kapan saja.

---

## 11. Admin

### 11.1 Auth

- Supabase Auth email + password. Pendaftaran publik DIMATIKAN di Supabase (lihat bagian 13).
- `/admin-login`: form email + password, server action `signIn` memakai `createServerClient` (cookies). Setelah sukses, cek `is_admin()` via rpc; jika false, `signOut` dan tampilkan "Akun ini bukan admin." Pesan error login generik: "Email atau password salah."
- Rate limit login sederhana: setelah 5 gagal dari IP yang sama dalam 15 menit, tolak (simpan di memori tidak cukup di serverless; pakai tabel kecil `login_attempts(ip_hash, created_at)` atau andalkan rate limit bawaan Supabase Auth. Pilih: andalkan Supabase Auth rate limit, dan tambahkan delay 800ms pada setiap kegagalan).
- `middleware.ts` (atau `proxy.ts` jika versi Next mewajibkan): refresh session Supabase; jika path diawali `/admin` dan tidak ada user, redirect ke `/admin-login?next=<path>`. Jika user login membuka `/admin-login`, redirect ke `/admin`.
- `lib/auth.ts`: `requireAdmin()` dipanggil di `app/admin/layout.tsx` DAN di awal setiap server action admin (middleware saja tidak cukup). Melempar `redirect("/admin-login")` jika gagal.
- Tombol "Keluar" di shell admin.

### 11.2 Shell admin

- Desktop: sidebar kiri 220px (Broadcast, Pojok Aspirasi, Lihat situs, Keluar). Mobile: bottom nav 3 item tinggi 56.
- Gaya sama dengan publik, kepadatan lebih tinggi (font 14).

### 11.3 `/admin/broadcasts`

- Ringkasan atas (mono): total, published, hidden, belum berkategori (lainnya), hari ini.
- Filter: status (Semua/Published/Hidden), kategori, sumber kategori (rule/ai/manual), search.
- Desktop: tabel kolom: checkbox, judul (2 baris), kategori (dropdown inline langsung ubah), sumber ("otomatis" / "aturan" / "manual"), grup, diterima, status (switch), pin (toggle), aksi (Edit, Klasifikasi ulang, Hapus).
- Mobile: kartu dengan kontrol yang sama dalam menu titik tiga.
- Bulk action untuk terpilih: ubah kategori, sembunyikan, tampilkan, hapus.
- Hapus permanen memakai dialog konfirmasi yang menyebut judul broadcast. Hapus juga file media di storage.

### 11.4 `/admin/broadcasts/[id]`

Form edit (server action `updateBroadcast`):
- Judul, body (textarea besar, monospace off), kategori (select), grup, pengirim, deadline (date), status, pinned.
- Editor link: daftar `{label, url}`, bisa tambah/hapus/ubah label/urutkan naik-turun; tombol "Ekstrak ulang dari body".
- Media: daftar thumbnail dengan tombol hapus.
- Panel kanan (desktop) / bawah (mobile): preview kartu publik live, info AI (model, confidence), tanggal dibuat/diubah, tombol "Klasifikasi ulang dengan AI", tombol "Buka publik".
- Simpan menampilkan toast; set `category_source='manual'` jika kategori diubah manual.

### 11.5 `/admin/aspirasi`

- Daftar pojok (tabel/kartu): judul, slug, jumlah total, jumlah hidden, auto-flagged, dibuka/ditutup (switch), tampil/sembunyi (switch), urutan.
- Tombol "Buat Pojok" membuka dialog: judul, pertanyaan, deskripsi, slug (auto dari judul, bisa diedit, validasi unik), max_length (default 80), dibuka (default ya).
- Aksi: edit, salin link publik, hapus (konfirmasi ketik slug).

### 11.6 `/admin/aspirasi/[id]`

- Header pojok + switch dibuka/tampil.
- Preview cloud (versi admin menampilkan juga yang hidden dengan opacity 0.35 dan garis coret).
- Tab: Semua / Tampil / Disembunyikan / Ditandai otomatis.
- Daftar aspirasi: teks, waktu, status, aksi Sembunyikan / Tampilkan / Hapus, dan "Sembunyikan semua dari pengirim ini" (berdasarkan ip_hash, tanpa menampilkan hash).
- Bulk select untuk sembunyikan/hapus.
- Tombol "Ekspor CSV" (teks, normalized, status, created_at; tanpa ip_hash).

### 11.7 Daftar server action (`app/admin/actions.ts`)

Semua memakai zod, `requireAdmin()`, dan mengembalikan `{ ok: true } | { ok: false, error: string }`:

```
updateBroadcast(id, data)
setBroadcastStatus(ids[], status)
setBroadcastCategory(ids[], category)
toggleBroadcastPin(id, pinned)
deleteBroadcasts(ids[])
reclassifyBroadcast(id)
reextractLinks(id)
createPojok(data)
updatePojok(id, data)
deletePojok(id)
setAspirationStatus(ids[], status)
deleteAspirations(ids[])
hideAspirationsBySameSender(aspirationId)
exportAspirationsCsv(pojokId)   // route handler GET /admin/aspirasi/[id]/export juga boleh
signOut()
```

Setiap action yang mengubah data publik memanggil `revalidatePath` yang relevan.

---

## 12. Cron keep-alive

Supabase free tier mem-pause project setelah 7 hari tanpa aktivitas. Jika broadcast jarang masuk, arsip bisa mati.

`vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/keepalive", "schedule": "0 1 * * *" }] }
```

`app/api/cron/keepalive/route.ts`: cek header `Authorization: Bearer ${CRON_SECRET}` (Vercel mengirimnya otomatis jika env `CRON_SECRET` ada), lalu `select id from broadcasts limit 1`. Balas `{ ok: true }`.

---

## 13. Panduan setup (untuk owner, lakukan berurutan)

### 13.1 Supabase

1. Buat project baru di supabase.com, region **Southeast Asia (Singapore)**.
2. Project Settings > API: salin Project URL, anon/publishable key, service_role/secret key ke env.
3. SQL Editor: jalankan seluruh `supabase/migrations/0001_init.sql`.
4. Storage: buat bucket `broadcast-media`, centang Public.
5. Authentication > Sign In / Providers: matikan "Allow new users to sign up". Email provider tetap aktif.
6. Authentication > Users > Add user: buat akun admin kamu (email + password kuat), centang auto confirm.
7. SQL Editor:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-kamu@contoh.com';
   ```
8. Authentication > URL Configuration: Site URL = domain Vercel kamu.

### 13.2 OpenRouter

1. Daftar di openrouter.ai, buat API key di Settings > Keys. Beri credit limit 0 pada key supaya tidak pernah memakai model berbayar secara tidak sengaja.
2. Isi `OPENROUTER_MODELS=openrouter/free`. Jika ingin model tertentu, buka katalog model, filter harga gratis, salin ID yang berakhiran `:free`, dan tulis 2 sampai 3 ID dipisah koma.
3. Dengan batas 50 request/hari, volume broadcast pribadi aman. Jika suatu hari kurang, sekali membeli kredit $10 menaikkan batas free ke 1.000/hari.

### 13.3 Vercel

1. Push repo ke GitHub, import di Vercel, framework Next.js.
2. Isi semua env dari bagian 2 untuk Production (dan Preview jika perlu).
3. Deploy. Catat domain production, misal `https://broadcast-archive.vercel.app`, dan isi `NEXT_PUBLIC_SITE_URL` dengan itu, lalu redeploy.
4. Pastikan Deployment Protection tidak aktif untuk domain production (webhook Telegram tidak bisa melewati proteksi Vercel Authentication). Jangan pakai URL preview untuk webhook.

### 13.4 Bot Telegram

1. Buka @BotFather, kirim `/newbot`, isi nama (misal "Broadcast Archive") dan username yang berakhiran `bot`. Salin token ke `TELEGRAM_BOT_TOKEN`.
2. Masih di BotFather, `/setcommands`, pilih bot, kirim:
   ```
   last - 5 broadcast terakhir
   undo - sembunyikan broadcast terakhir
   help - bantuan dan format header
   ```
3. Buat secret: `openssl rand -hex 32`, isi ke `TELEGRAM_WEBHOOK_SECRET` (hanya boleh huruf, angka, `_`, `-`).
4. Sementara `TELEGRAM_OWNER_ID` boleh diisi `0`. Redeploy.
5. Daftarkan webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://<DOMAIN>/api/telegram",
       "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
       "allowed_updates": ["message", "callback_query"],
       "drop_pending_updates": true,
       "max_connections": 10
     }'
   ```
6. Cek: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`. Pastikan `url` benar, `pending_update_count` 0, dan tidak ada `last_error_message`.
7. Buka chat bot kamu di Telegram, kirim `/start`. Bot membalas ID kamu. Isi `TELEGRAM_OWNER_ID` dengan angka itu di Vercel, redeploy.
8. Kirim `/start` lagi; status harus "owner".
9. Pin chat bot di Telegram supaya selalu muncul paling atas di share sheet.

### 13.5 Cara pakai harian

1. Di WhatsApp, tekan lama pesan broadcast. Android: menu titik tiga > Bagikan (Share). iOS: Lainnya / More, lalu ikon share. Jika menu share tidak tersedia untuk pesan itu, pilih Salin lalu tempel di chat bot.
2. Pilih Telegram > chat bot kamu.
3. Opsional, sebelum kirim tambahkan baris pertama: `#Nama Grup | Nama Pengirim`. Contoh: `#IF 2023 | Kahim`.
4. Kirim. Bot membalas "Tersimpan" dengan link dan tombol kategori. Beberapa detik kemudian pesan berubah ke kategori hasil AI. Tekan tombol kategori lain jika salah.
5. Gambar: share gambar dari WhatsApp ke bot; caption-nya menjadi body.

### 13.6 Troubleshooting

- Bot diam: `getWebhookInfo`, lihat `last_error_message`. 403 berarti secret tidak sama. 401/404 berarti URL salah atau terkena Deployment Protection.
- Kategori tidak pernah berubah dari "sementara": cek log Vercel untuk error `openrouter`; 429 berarti batas harian habis, 402 berarti saldo negatif.
- Situs error setelah lama tidak dipakai: project Supabase ter-pause; buka dashboard Supabase dan Restore, lalu pastikan cron keep-alive berjalan (Vercel > Settings > Cron Jobs).

---

## 14. Keamanan (checklist yang harus dipenuhi kode)

- [ ] Service role key hanya diimport di file dengan `import "server-only"`.
- [ ] Webhook memverifikasi `X-Telegram-Bot-Api-Secret-Token` sebelum membaca body lebih jauh.
- [ ] Semua aksi bot (selain `/start`) dan semua callback memverifikasi `from.id === TELEGRAM_OWNER_ID`.
- [ ] Idempotensi `update_id` via primary key.
- [ ] Semua server action admin memanggil `requireAdmin()` sendiri.
- [ ] Tidak ada `dangerouslySetInnerHTML` untuk konten pengguna.
- [ ] Link eksternal `target="_blank" rel="noopener noreferrer"`; hanya protokol http/https yang dirender sebagai link.
- [ ] `ip_hash` tidak pernah dikirim ke client.
- [ ] Header keamanan di `next.config`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, CSP dasar yang mengizinkan Supabase (https + wss) dan storage.
- [ ] `/admin` dan `/admin-login` diberi `robots: noindex`.

---

## 15. Kualitas dan verifikasi (Claude Code wajib menjalankan)

1. `pnpm build` tanpa error dan tanpa warning TypeScript.
2. Unit test (vitest) untuk: `parseHeader`, `extractLinks` (termasuk `forms.gle/abc`, URL dengan tanda baca di akhir, text_link entity), `labelFor`, `normalizeAspiration`, `classifyByRules`, parser JSON AI (input dengan teks sebelum/sesudah JSON, kategori tidak valid jadi `lainnya`), ekstraksi deadline.
3. Test route handler webhook dengan payload contoh: secret salah (403), bukan owner (ditolak), update duplikat (diabaikan), pesan teks baru (tersimpan), pesan duplikat konten, callback ganti kategori.
4. Uji manual E2E setelah deploy:
   - Share broadcast dengan 2 link dari WhatsApp, muncul di `/` dengan 2 tombol link, kategori berubah dari rule ke AI.
   - Tombol kategori di Telegram mengubah kategori di web, AI tidak menimpanya.
   - `/undo` menyembunyikan broadcast.
   - Buat Pojok dari admin, kirim jawaban sama dari 2 perangkat berbeda: kata membesar realtime tanpa refresh.
   - Kirim jawaban sama 2x dari perangkat yang sama: ditolak.
   - Kata kasar: tidak muncul publik, muncul di tab "Ditandai otomatis".
   - Lighthouse mobile untuk `/` dan `/b/[id]`: Performance >= 90, Accessibility >= 95.
5. Cek tampilan di lebar 360, 390, 768, 1024, 1440.

---

## 16. Batasan yang diketahui

- Metadata asli (nama grup, pengirim, waktu asli) hilang saat share dari WhatsApp; hanya ada jika owner menulis header. `received_at` adalah waktu bot menerima, bukan waktu broadcast dikirim di grup.
- Pencocokan cloud adalah persis setelah normalisasi, bukan kemiripan makna. "jam lab diperpanjang" dan "perpanjang jam lab" dihitung berbeda.
- Model free OpenRouter bisa berubah atau hilang; sistem tetap berjalan dengan klasifikasi aturan.
- Anti spam anonim berbasis hash IP, bukan identitas. Cukup untuk lingkup angkatan, tidak tahan serangan terarah.
- Isi broadcast orang lain ditampilkan publik. Pastikan anggota grup tahu arsip ini ada dan jangan menyimpan broadcast yang berisi data pribadi (nomor HP, NIM daftar nama) tanpa menyuntingnya di admin.

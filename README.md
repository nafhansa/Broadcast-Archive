# Broadcast Archive

Implementasi dari `IMPLEMENT.md`. Next.js (App Router) + Supabase + Telegram bot + OpenRouter.

## Menjalankan

```bash
cp .env.example .env.local   # isi semua nilai
pnpm install
pnpm dev
pnpm test        # vitest
pnpm build
```

Setup Supabase, OpenRouter, Vercel, dan bot Telegram: lihat bagian 13 di `IMPLEMENT.md`.
Migrasi database: `supabase/migrations/0001_init.sql` (jalankan di SQL Editor).

## Catatan implementasi

- Webhook Telegram: `app/api/telegram/route.ts` (Route Handler). Klasifikasi AI berjalan lewat `after()`.
- `proxy.ts` adalah nama middleware di Next 16.
- Realtime memakai publication dengan daftar kolom eksplisit, jadi `ip_hash` tidak ikut terkirim ke browser.
- TypeScript dipin ke 6.x karena typescript-eslint belum mendukung 7.

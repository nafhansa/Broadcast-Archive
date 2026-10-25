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
  links jsonb not null default '[]'::jsonb,
  media jsonb not null default '[]'::jsonb,
  source_group text,
  sender text,
  deadline date,
  status broadcast_status not null default 'published',
  pinned boolean not null default false,
  content_hash text not null unique,
  tg_chat_id bigint,
  tg_message_ids bigint[] not null default '{}',
  tg_confirm_message_id bigint,
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

-- TELEGRAM UPDATE LOG
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
  is_open boolean not null default true,
  is_visible boolean not null default true,
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
  unique (pojok_id, ip_hash, normalized)
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

-- ip_hash tidak boleh terbaca publik
revoke select on public.aspirations from anon;
grant select (id, pojok_id, text, normalized, status, auto_flagged, created_at) on public.aspirations to anon;

-- Realtime untuk cloud live. Daftar kolom eksplisit supaya ip_hash tidak ikut terkirim ke client.
alter publication supabase_realtime add table public.aspirations (id, pojok_id, text, normalized, status, auto_flagged, created_at);

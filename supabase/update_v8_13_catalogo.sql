-- ALACENA v8.13.0: catálogo del súper (productos propios y los que se quitan del catálogo base)
create table if not exists public.catalog_items (
 id uuid primary key default gen_random_uuid(),
 section text not null,
 name text not null,
 hidden boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.catalog_items enable row level security;
drop policy if exists "authenticated full access" on public.catalog_items;
create policy "authenticated full access" on public.catalog_items for all to authenticated using (true) with check (true);

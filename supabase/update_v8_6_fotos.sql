-- ALACENA 8.6 · Fotos de recetas
-- Pega TODO esto en Supabase → SQL Editor → Run. Es seguro correrlo más de una vez.
alter table public.recipes add column if not exists image_url text;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152;

drop policy if exists "authenticated recipe photos" on storage.objects;
create policy "authenticated recipe photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'recipe-photos') with check (bucket_id = 'recipe-photos');

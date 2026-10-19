-- ALACENA v8.9.1: guarda quién vive en casa (adultos, niños, bebé)
alter table public.preferences add column if not exists household jsonb;

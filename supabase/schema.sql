create extension if not exists pgcrypto;

create table if not exists public.grocery_items (
 id uuid primary key default gen_random_uuid(), text text not null, category text not null check (category in ('Frutas y verduras','Carnes y pescado','Lácteos y huevos','Despensa','Limpieza y hogar','Otros')), checked boolean not null default false, source text not null default 'manual', created_at timestamptz not null default now()
);
create table if not exists public.recipes (
 id uuid primary key default gen_random_uuid(), name text not null, ingredients jsonb not null default '[]'::jsonb, notes text not null default '', tags jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.menu_weeks (
 id uuid primary key default gen_random_uuid(), label text not null default 'Semana actual', week_start date not null default current_date, days jsonb not null default '{"Lunes":{"lunch":"","dinner":""},"Martes":{"lunch":"","dinner":""},"Miércoles":{"lunch":"","dinner":""},"Jueves":{"lunch":"","dinner":""},"Viernes":{"lunch":"","dinner":""},"Sábado":{"lunch":"","dinner":""},"Domingo":{"lunch":"","dinner":""}}'::jsonb, archived boolean not null default false, created_at timestamptz not null default now()
);
create unique index if not exists only_one_active_week on public.menu_weeks ((archived)) where archived=false;
create table if not exists public.purchases (
 id uuid primary key default gen_random_uuid(), store text not null, purchase_date date not null, image_path text, total numeric(12,2) not null default 0, raw_ai_response jsonb, status text not null default 'draft', created_at timestamptz not null default now()
);
create table if not exists public.purchase_items (
 id uuid primary key default gen_random_uuid(), purchase_id uuid not null references public.purchases(id) on delete cascade, name text not null, category text not null check (category in ('Frutas y verduras','Carnes y pescado','Lácteos y huevos','Despensa','Limpieza y hogar','Otros')), quantity numeric(10,3), unit_price numeric(12,2), total_price numeric(12,2) not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.preferences (
 id integer primary key default 1 check (id=1), diet_user text not null default '', diet_partner text not null default '', kids_recipes boolean not null default true, budget_priority boolean not null default true, updated_at timestamptz not null default now()
);
insert into public.preferences(id) values(1) on conflict(id) do nothing;
insert into public.menu_weeks(label,week_start,archived) select 'Semana actual',current_date,false where not exists(select 1 from public.menu_weeks where archived=false);

create index if not exists grocery_items_category_idx on public.grocery_items(category);
create index if not exists purchases_date_idx on public.purchases(purchase_date desc);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);
create index if not exists menu_weeks_archived_idx on public.menu_weeks(archived,week_start desc);

alter table public.grocery_items enable row level security;
alter table public.recipes enable row level security;
alter table public.menu_weeks enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.preferences enable row level security;

do $$ declare t text; begin
 foreach t in array array['grocery_items','recipes','menu_weeks','purchases','purchase_items','preferences'] loop
  execute format('drop policy if exists "authenticated full access" on public.%I',t);
  execute format('create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)',t);
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('receipts','receipts',false,8388608,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update set public=false,file_size_limit=8388608;

drop policy if exists "authenticated receipt access" on storage.objects;
create policy "authenticated receipt access" on storage.objects for all to authenticated using(bucket_id='receipts') with check(bucket_id='receipts');

do $$ declare t text; begin
 foreach t in array array['grocery_items','recipes','menu_weeks','purchases','purchase_items','preferences'] loop
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;

-- Alacena 2.0: despensa, recurrencias y sobrantes
alter table public.grocery_items add column if not exists quantity numeric(10,3) default 1;
alter table public.grocery_items add column if not exists unit text default 'pza';
alter table public.recipes add column if not exists prep_minutes integer;
alter table public.recipes add column if not exists servings integer;
alter table public.recipes add column if not exists favorite boolean not null default false;
alter table public.recipes add column if not exists nutrition jsonb;
alter table public.preferences add column if not exists monthly_budget numeric(12,2) not null default 8000;
alter table public.preferences add column if not exists notifications_enabled boolean not null default false;

create table if not exists public.pantry_items (
 id uuid primary key default gen_random_uuid(), name text not null, category text not null check(category in ('Frutas y verduras','Carnes y pescado','Lácteos y huevos','Despensa','Limpieza y hogar','Otros')), quantity numeric(10,3) not null default 1, unit text not null default 'pza', expires_on date, low_stock_at numeric(10,3) not null default 1, barcode text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.recurring_items (
 id uuid primary key default gen_random_uuid(), text text not null, category text not null, quantity numeric(10,3) not null default 1, unit text not null default 'pza', frequency text not null default 'weekly', next_due date not null default current_date, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.leftovers (
 id uuid primary key default gen_random_uuid(), name text not null, quantity text not null default '1', expires_on date, created_at timestamptz not null default now()
);
create index if not exists pantry_expiry_idx on public.pantry_items(expires_on);
create index if not exists pantry_barcode_idx on public.pantry_items(barcode);
create index if not exists recurring_due_idx on public.recurring_items(next_due) where active=true;

alter table public.pantry_items enable row level security;
alter table public.recurring_items enable row level security;
alter table public.leftovers enable row level security;
do $$ declare t text; begin
 foreach t in array array['pantry_items','recurring_items','leftovers'] loop
  execute format('drop policy if exists "authenticated full access" on public.%I',t);
  execute format('create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)',t);
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;

-- Alacena 3.0: notificaciones push por dispositivo
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth text not null,
 device_name text,
 enabled boolean not null default true,
 expiry_alerts boolean not null default true,
 menu_alerts boolean not null default true,
 missing_ingredients_alerts boolean not null default true,
 budget_alerts boolean not null default true,
 recurring_alerts boolean not null default true,
 expiry_days_before integer not null default 3 check(expiry_days_before between 1 and 30),
 daily_menu_hour integer not null default 8 check(daily_menu_hour between 0 and 23),
 missing_ingredients_hour integer not null default 18 check(missing_ingredients_hour between 0 and 23),
 budget_threshold integer not null default 80 check(budget_threshold between 1 and 100),
 quiet_start integer not null default 21 check(quiet_start between 0 and 23),
 quiet_end integer not null default 8 check(quiet_end between 0 and 23),
 max_daily_notifications integer not null default 3 check(max_daily_notifications between 1 and 10),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.notification_log (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid references public.push_subscriptions(id) on delete cascade,
 type text not null,
 dedupe_key text not null,
 title text not null,
 body text not null,
 status text not null check(status in ('sent','failed','skipped')),
 error_message text,
 sent_at timestamptz not null default now(),
 unique(subscription_id,dedupe_key)
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id) where enabled=true;
create index if not exists notification_log_sent_idx on public.notification_log(subscription_id,sent_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions" on public.push_subscriptions
 for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "users read own notification history" on public.notification_log;
create policy "users read own notification history" on public.notification_log
 for select to authenticated using(
  exists(select 1 from public.push_subscriptions s where s.id=subscription_id and s.user_id=auth.uid())
 );

-- notification_log writes are performed only by the server with SUPABASE_SERVICE_ROLE_KEY.

-- Badge "nouveau dans le QG" : suit la dernière lecture du QG par utilisateur.
-- À exécuter dans l'éditeur SQL de Supabase.

create table if not exists public.qg_last_read (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

alter table public.qg_last_read enable row level security;

drop policy if exists "qg_last_read - own select" on public.qg_last_read;
create policy "qg_last_read - own select"
  on public.qg_last_read for select
  using (auth.uid() = user_id);

drop policy if exists "qg_last_read - own upsert" on public.qg_last_read;
create policy "qg_last_read - own upsert"
  on public.qg_last_read for insert
  with check (auth.uid() = user_id);

drop policy if exists "qg_last_read - own update" on public.qg_last_read;
create policy "qg_last_read - own update"
  on public.qg_last_read for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Préférence : recevoir le badge d'activité du QG (in-app uniquement)
alter table public.notification_preferences
  add column if not exists qg_app boolean not null default true;

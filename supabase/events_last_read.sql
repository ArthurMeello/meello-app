-- Pastille "nouvel événement" : suit la dernière visite de la page Événements.
-- À exécuter dans l'éditeur SQL de Supabase.

create table if not exists public.events_last_read (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

alter table public.events_last_read enable row level security;

drop policy if exists "events_last_read - own select" on public.events_last_read;
create policy "events_last_read - own select"
  on public.events_last_read for select using (auth.uid() = user_id);

drop policy if exists "events_last_read - own insert" on public.events_last_read;
create policy "events_last_read - own insert"
  on public.events_last_read for insert with check (auth.uid() = user_id);

drop policy if exists "events_last_read - own update" on public.events_last_read;
create policy "events_last_read - own update"
  on public.events_last_read for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

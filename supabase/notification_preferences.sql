-- Préférences de notification par utilisateur
-- À exécuter dans l'éditeur SQL de Supabase.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Messages privés
  messages_app   boolean not null default true,
  messages_email boolean not null default true,

  -- Demandes de connexion
  connections_app   boolean not null default true,
  connections_email boolean not null default true,

  -- Recommandations
  recommendations_app   boolean not null default true,
  recommendations_email boolean not null default true,

  -- Activité communauté (mentions, réponses forum / QG / feed)
  community_app   boolean not null default true,
  community_email boolean not null default true,

  updated_at timestamptz not null default now()
);

-- Row Level Security : chaque utilisateur ne voit/modifie que sa ligne
alter table public.notification_preferences enable row level security;

drop policy if exists "own prefs - select" on public.notification_preferences;
create policy "own prefs - select"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "own prefs - insert" on public.notification_preferences;
create policy "own prefs - insert"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "own prefs - update" on public.notification_preferences;
create policy "own prefs - update"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

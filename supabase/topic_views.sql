-- ============================================================================
-- Vues de sujets de la communauté (qui a vu quel sujet) — infobulle admin.
-- À exécuter dans l'éditeur SQL de Supabase.
-- ============================================================================

create table if not exists public.topic_views (
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);

create index if not exists topic_views_topic_idx on public.topic_views (topic_id);

alter table public.topic_views enable row level security;

drop policy if exists "topic_views - insert own" on public.topic_views;
create policy "topic_views - insert own" on public.topic_views
  for insert to authenticated with check (auth.uid() = user_id);

-- Pas de lecture publique : la liste des vues n'est lisible que via la route
-- serveur (service role), réservée à l'admin.

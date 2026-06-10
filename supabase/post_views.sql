-- ============================================================================
-- Vues de posts (qui a vu quel post) — pour l'infobulle admin.
-- À exécuter dans l'éditeur SQL de Supabase.
-- ============================================================================

create table if not exists public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_views_post_idx on public.post_views (post_id);

alter table public.post_views enable row level security;

-- Chacun peut enregistrer SA propre vue (insert pour soi).
drop policy if exists "post_views - insert own" on public.post_views;
create policy "post_views - insert own" on public.post_views
  for insert to authenticated with check (auth.uid() = user_id);

-- Pas de policy de lecture publique : la liste des vues n'est lisible que
-- via la route serveur (service role), réservée à l'admin.

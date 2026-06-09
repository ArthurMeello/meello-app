-- ============================================================================
-- GAMIFICATION MEELLO — Schéma Supabase (Lot 1 : fondation)
-- À exécuter dans l'éditeur SQL de Supabase.
-- Aligné sur GAMIFICATION_MEELLO.md.
--
-- Principes :
--  - On stocke UNIQUEMENT profiles.xp (total). Le niveau et le palier sont
--    recalculés en code (échelle 1-100, source de vérité = le code).
--  - xp_logs garde l'historique des gains + sert aux plafonds journaliers.
--  - Séries hebdo (flamme) et défis hebdo ont leurs propres tables.
--  - RLS : chacun lit ses données ; seules les routes serveur (service role)
--    écrivent les XP, séries et défis (pas d'écriture directe par le client).
-- ============================================================================

-- ─── 1. Colonne XP sur profiles + reset à zéro ──────────────────────────────
alter table public.profiles
  add column if not exists xp integer not null default 0;

-- Série de semaines consécutives (flamme). Mise à jour par le cron hebdo.
alter table public.profiles
  add column if not exists streak_weeks integer not null default 0;

-- Reset propre : démarrage du nouveau système à 0 pour tout le monde.
update public.profiles set xp = 0, streak_weeks = 0;

-- ─── 2. Historique des gains d'XP ───────────────────────────────────────────
-- Sert d'historique ET de base pour les plafonds journaliers / la dégressivité.
create table if not exists public.xp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,            -- ex : 'comment_post', 'like_post', 'poll_vote', 'event_joined'...
  xp_earned integer not null,
  created_at timestamptz not null default now()
);

create index if not exists xp_logs_user_action_day_idx
  on public.xp_logs (user_id, action, created_at);

-- On repart d'un historique vierge (cohérent avec le reset des XP).
truncate table public.xp_logs;

-- ─── 3. Séries hebdomadaires (badge flamme) ─────────────────────────────────
-- Une ligne par membre et par semaine "ouvrée" validée (≥4 jours actifs sur 5).
-- week_start = lundi de la semaine (date). La série = nb de semaines consécutives.
create table if not exists public.weekly_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,            -- lundi de la semaine concernée
  active_days smallint not null default 0,  -- nb de jours ouvrés actifs (0..5)
  validated boolean not null default false, -- true dès que active_days >= 4
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_streaks_user_idx
  on public.weekly_streaks (user_id, week_start);

-- Suivi léger de l'activité journalière (sert à calculer active_days/semaine).
-- Une ligne par membre et par jour où il a été actif.
create table if not exists public.daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

-- ─── 4. Défis de la semaine ─────────────────────────────────────────────────
-- Catalogue des défis (banque). Géré côté serveur ; rarement modifié.
create table if not exists public.challenges (
  id text primary key,                 -- ex : 'brise_la_glace', 'donne_ton_avis'...
  label text not null,
  description text not null,
  boost_xp integer not null,
  target integer not null default 1,   -- objectif à atteindre (ex : 2 connexions)
  active boolean not null default true
);

-- Défis assignés à chaque membre pour une semaine donnée (3 par membre).
create table if not exists public.weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null references public.challenges(id) on delete cascade,
  week_start date not null,            -- lundi de la semaine
  progress integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_id, week_start)
);

create index if not exists weekly_challenges_user_week_idx
  on public.weekly_challenges (user_id, week_start);

-- Banque de défis initiale (alignée sur le doc de référence).
insert into public.challenges (id, label, description, boost_xp, target) values
  ('brise_la_glace',   'Brise la glace',     '2 nouvelles connexions',                       60, 2),
  ('fais_connaissance','Fais connaissance',  'Visiter 3 profils, se connecter à au moins 1', 50, 3),
  ('donne_ton_avis',   'Donne ton avis',     'Commenter 3 posts (feed ou communauté)',       50, 3),
  ('partage_ton_actu', 'Partage ton actu',   'Publier un post cette semaine',                40, 1),
  ('complete_profil',  'Complète ton profil','Enrichir son profil',                          30, 1)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  boost_xp = excluded.boost_xp,
  target = excluded.target;

-- ─── 5. RLS ─────────────────────────────────────────────────────────────────
-- Lecture : chacun lit ses propres lignes (et tout le monde lit le catalogue).
-- Écriture : réservée aux routes serveur (service role), donc PAS de policy
-- d'insert/update publique sur les tables de gains.

alter table public.xp_logs enable row level security;
drop policy if exists "xp_logs - read own" on public.xp_logs;
create policy "xp_logs - read own" on public.xp_logs
  for select to authenticated using (auth.uid() = user_id);

alter table public.weekly_streaks enable row level security;
drop policy if exists "weekly_streaks - read own" on public.weekly_streaks;
create policy "weekly_streaks - read own" on public.weekly_streaks
  for select to authenticated using (auth.uid() = user_id);

alter table public.daily_activity enable row level security;
drop policy if exists "daily_activity - read own" on public.daily_activity;
create policy "daily_activity - read own" on public.daily_activity
  for select to authenticated using (auth.uid() = user_id);

alter table public.challenges enable row level security;
drop policy if exists "challenges - read all" on public.challenges;
create policy "challenges - read all" on public.challenges
  for select to authenticated using (true);

alter table public.weekly_challenges enable row level security;
drop policy if exists "weekly_challenges - read own" on public.weekly_challenges;
create policy "weekly_challenges - read own" on public.weekly_challenges
  for select to authenticated using (auth.uid() = user_id);

-- Note : profiles.xp est lisible via les policies existantes de profiles
-- (les flammes/niveaux des autres membres sont visibles dans l'annuaire).
-- L'écriture de profiles.xp se fait via le service role (route award-xp).

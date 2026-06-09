-- ============================================================================
-- GAMIFICATION MEELLO — Backfill rétroactif des XP (script ONE-SHOT)
-- À exécuter UNE SEULE FOIS dans l'éditeur SQL de Supabase, APRÈS gamification.sql.
--
-- Crédite les XP des actions DÉJÀ réalisées par les membres, fidèlement au
-- barème : plafonds journaliers respectés, connexions dégressives par ordre
-- chronologique. Écrit dans xp_logs (action suffixée '_backfill') puis
-- recalcule profiles.xp.
--
-- IMPORTANT :
--   - Idempotent : on supprime d'abord les lignes _backfill existantes.
--   - Le boost x2 n'est PAS appliqué au rétroactif (XP "purs" du passé).
--   - Hypothèses de colonnes : voir chaque bloc. Adapter si besoin.
-- ============================================================================

begin;

-- 0) Repartir propre : enlever un éventuel backfill précédent.
delete from public.xp_logs where action like '%_backfill';

-- ─── 1) Likes (reactions) : +2, plafond 5/jour, hors auto-like ───────────────
with ranked as (
  select r.author_id as user_id, r.created_at,
         row_number() over (
           partition by r.author_id, (r.created_at at time zone 'UTC')::date
           order by r.created_at
         ) as rn
  from public.reactions r
  join public.posts p on p.id = r.post_id
  where r.author_id is not null and p.author_id <> r.author_id
)
insert into public.xp_logs (user_id, action, xp_earned, created_at)
select user_id, 'like_post_backfill', 2, created_at from ranked where rn <= 5;

-- ─── 2) Commentaires : +8, plafond 3/jour, hors commentaire de son propre post ─
with ranked as (
  select c.author_id as user_id, c.created_at,
         row_number() over (
           partition by c.author_id, (c.created_at at time zone 'UTC')::date
           order by c.created_at
         ) as rn
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.author_id is not null and p.author_id <> c.author_id
)
insert into public.xp_logs (user_id, action, xp_earned, created_at)
select user_id, 'comment_post_backfill', 8, created_at from ranked where rn <= 3;

-- ─── 3) Votes de sondage : +2, plafond 3/jour ───────────────────────────────
with ranked as (
  select v.user_id, v.created_at,
         row_number() over (
           partition by v.user_id, (v.created_at at time zone 'UTC')::date
           order by v.created_at
         ) as rn
  from public.qg_poll_votes v
  where v.user_id is not null
)
insert into public.xp_logs (user_id, action, xp_earned, created_at)
select user_id, 'poll_vote_backfill', 2, created_at from ranked where rn <= 3;

-- ─── 4) Participations événements : +15, plafond 3/jour ──────────────────────
-- Hypothèse : event_participants a une colonne created_at. Sinon, retirer le
-- plafond journalier (mettre rn <= 999) ou adapter la colonne de date.
with ranked as (
  select ep.user_id, ep.created_at,
         row_number() over (
           partition by ep.user_id, (ep.created_at at time zone 'UTC')::date
           order by ep.created_at
         ) as rn
  from public.event_participants ep
  where ep.user_id is not null
)
insert into public.xp_logs (user_id, action, xp_earned, created_at)
select user_id, 'event_joined_backfill', 15, created_at from ranked where rn <= 3;

-- ─── 5) Connexions acceptées : dégressif (+30 / +10 x9 / 0), DEUX côtés ───────
-- Pour chaque membre, on ordonne ses connexions acceptées par date et on
-- applique 30 à la 1re, 10 aux suivantes (2..10), 0 ensuite.
with conn_per_user as (
  -- déplier chaque connexion acceptée vers ses DEUX participants
  select requester_id as user_id, created_at from public.connections where status = 'accepted'
  union all
  select receiver_id as user_id, created_at from public.connections where status = 'accepted'
),
ranked as (
  select user_id, created_at,
         row_number() over (partition by user_id order by created_at) as rn
  from conn_per_user
  where user_id is not null
)
insert into public.xp_logs (user_id, action, xp_earned, created_at)
select user_id, 'connection_accepted_backfill',
       case when rn = 1 then 30 when rn <= 10 then 10 else 0 end,
       created_at
from ranked
where rn <= 10; -- au-delà de 10 : 0 XP, inutile de logguer

-- ─── 6) Première fiche service : +50 (une seule par membre, la plus ancienne) ─
with first_service as (
  select profile_id as user_id, min(created_at) as created_at
  from public.service_items
  where profile_id is not null
  group by profile_id
)
insert into public.xp_logs (user_id, action, xp_earned, created_at)
select user_id, 'first_service_backfill', 50, created_at from first_service;

-- ─── 7) Profil complété à 100% : +150 (ceux qui le sont déjà aujourd'hui) ─────
-- Critère : avatar + bio + activité + ville renseignés (aligné sur la route).
insert into public.xp_logs (user_id, action, xp_earned, created_at)
select id, 'profile_completed_backfill', 150, now()
from public.profiles
where coalesce(avatar_url,'') <> ''
  and coalesce(bio,'') <> ''
  and coalesce(activity,'') <> ''
  and coalesce(city,'') <> '';

-- ─── 8) Recalculer profiles.xp depuis l'ensemble des xp_logs ──────────────────
update public.profiles p
set xp = coalesce((
  select sum(xp_earned) from public.xp_logs l where l.user_id = p.id
), 0);

commit;

-- Vérification rapide (à lancer séparément) :
--   select p.id, p.xp from public.profiles p order by p.xp desc;

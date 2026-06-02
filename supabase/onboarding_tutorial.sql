-- Mémorise si le tutoriel d'onboarding a été complété (ou passé) par le membre.
-- À exécuter dans l'éditeur SQL de Supabase.

alter table public.profiles
  add column if not exists tutorial_done boolean not null default false;

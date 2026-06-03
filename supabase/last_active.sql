-- Dernière activité d'un membre sur Meello (mise à jour à chaque visite de l'app).
-- À exécuter dans l'éditeur SQL de Supabase.

alter table public.profiles
  add column if not exists last_active timestamptz;

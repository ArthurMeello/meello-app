-- Ajoute les colonnes Newsletter (e-mail uniquement) à la table existante.
-- À exécuter dans l'éditeur SQL de Supabase.

alter table public.notification_preferences
  add column if not exists newsletter_app   boolean not null default true,
  add column if not exists newsletter_email boolean not null default true;

-- Rappels e-mail de messages privés non lus (envoyés au plus une fois par message).
-- À exécuter dans l'éditeur SQL de Supabase.

create table if not exists public.message_reminders (
  message_id uuid primary key references public.meello_messages(id) on delete cascade,
  reminded_at timestamptz not null default now()
);

-- Pas de RLS nécessaire : table interne, manipulée uniquement par la route
-- serveur (service role). On l'active quand même par sécurité, sans policy
-- publique (seul le service role y accède).
alter table public.message_reminders enable row level security;

-- Réactiver l'e-mail des messages par défaut (le rappel respecte ce toggle)
alter table public.notification_preferences
  alter column messages_email set default true;

-- Optionnel : remettre à true ceux qui étaient à false par défaut historique.
-- (À ne lancer que si tu veux activer le rappel pour tous les membres existants.)
-- update public.notification_preferences set messages_email = true where messages_email = false;

-- Abonnements aux notifications push (PWA / Web Push).
-- Un même membre peut avoir plusieurs abonnements (plusieurs appareils/navigateurs).
-- La clé d'unicité est l'endpoint fourni par le navigateur.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Un membre ne voit/gère que ses propres abonnements.
-- L'écriture passe par le service role (routes serveur), mais on autorise aussi
-- la lecture/suppression par le membre lui-même pour la gestion côté client.
drop policy if exists "own subscriptions read" on public.push_subscriptions;
create policy "own subscriptions read"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "own subscriptions delete" on public.push_subscriptions;
create policy "own subscriptions delete"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

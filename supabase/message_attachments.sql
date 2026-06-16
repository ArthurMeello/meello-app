-- ============================================================================
-- Pièces jointes dans les messages (privés + QG).
-- À exécuter dans l'éditeur SQL de Supabase.
--
-- Puis créer le bucket de stockage 'attachments' (voir note en bas).
-- ============================================================================

-- Messages privés
alter table public.meello_messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

-- Messages du QG
alter table public.qg_messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

-- ── Bucket de stockage ──────────────────────────────────────────────────────
-- Créer un bucket PUBLIC nommé 'attachments' dans Storage (interface Supabase),
-- puis ajouter les policies ci-dessous pour permettre l'upload aux membres
-- connectés et la lecture publique.

-- Upload réservé aux utilisateurs authentifiés
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "attachments - upload authenticated" on storage.objects;
create policy "attachments - upload authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists "attachments - read public" on storage.objects;
create policy "attachments - read public"
  on storage.objects for select to public
  using (bucket_id = 'attachments');

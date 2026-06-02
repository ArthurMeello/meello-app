-- Permet aux DEUX participants d'une connexion de la supprimer
-- (sinon la suppression est unilatérale : seul le requester peut retirer).
-- À exécuter dans l'éditeur SQL de Supabase.

alter table public.connections enable row level security;

drop policy if exists "connections - delete by participant" on public.connections;
create policy "connections - delete by participant"
  on public.connections for delete
  using (
    auth.uid() = requester_id
    or auth.uid() = receiver_id
  );

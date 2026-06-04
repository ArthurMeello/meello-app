-- Édition de sondage : modifier la question + ajouter des options.
-- Autorisé au créateur ET à l'admin. À exécuter dans l'éditeur SQL Supabase.

-- Helper is_admin() existe déjà (créé dans ghost_account.sql). Sinon :
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select auth.uid() = '13cdb485-42e0-48df-b2f8-14dc77dd895a'::uuid
$$;

-- Modifier la question (créateur ou admin)
drop policy if exists "qg_polls update" on public.qg_polls;
create policy "qg_polls update" on public.qg_polls for update to authenticated
  using (auth.uid() = created_by or public.is_admin())
  with check (auth.uid() = created_by or public.is_admin());

-- Ajouter des options (créateur du sondage ou admin)
drop policy if exists "qg_poll_options insert" on public.qg_poll_options;
create policy "qg_poll_options insert" on public.qg_poll_options for insert to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from public.qg_polls p where p.id = poll_id and p.created_by = auth.uid())
  );

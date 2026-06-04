-- Sondages dans le QG (choix unique, votes visibles de tous).
-- À exécuter dans l'éditeur SQL de Supabase.

create table if not exists public.qg_polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.qg_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.qg_polls(id) on delete cascade,
  label text not null,
  position int not null default 0
);

create table if not exists public.qg_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.qg_polls(id) on delete cascade,
  option_id uuid not null references public.qg_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id) -- un seul vote par membre et par sondage
);

-- Lien optionnel : un message du QG peut être un sondage
alter table public.qg_messages
  add column if not exists poll_id uuid references public.qg_polls(id) on delete cascade;

-- ── RLS ──
alter table public.qg_polls enable row level security;
alter table public.qg_poll_options enable row level security;
alter table public.qg_poll_votes enable row level security;

-- Tout membre connecté peut lire
drop policy if exists "qg_polls read" on public.qg_polls;
create policy "qg_polls read" on public.qg_polls for select to authenticated using (true);
drop policy if exists "qg_poll_options read" on public.qg_poll_options;
create policy "qg_poll_options read" on public.qg_poll_options for select to authenticated using (true);
drop policy if exists "qg_poll_votes read" on public.qg_poll_votes;
create policy "qg_poll_votes read" on public.qg_poll_votes for select to authenticated using (true);

-- Création d'un sondage : par son auteur
drop policy if exists "qg_polls insert" on public.qg_polls;
create policy "qg_polls insert" on public.qg_polls for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "qg_poll_options insert" on public.qg_poll_options;
create policy "qg_poll_options insert" on public.qg_poll_options for insert to authenticated
  with check (exists (select 1 from public.qg_polls p where p.id = poll_id and p.created_by = auth.uid()));

-- Vote : chacun pour soi
drop policy if exists "qg_poll_votes insert" on public.qg_poll_votes;
create policy "qg_poll_votes insert" on public.qg_poll_votes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "qg_poll_votes update" on public.qg_poll_votes;
create policy "qg_poll_votes update" on public.qg_poll_votes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "qg_poll_votes delete" on public.qg_poll_votes;
create policy "qg_poll_votes delete" on public.qg_poll_votes for delete to authenticated using (auth.uid() = user_id);

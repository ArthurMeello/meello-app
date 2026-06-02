-- ════════════════════════════════════════════════════════════════════════
-- COMPTE FANTÔME : rend un compte test invisible pour tous, sauf l'admin.
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️  À LIRE AVANT D'EXÉCUTER
-- Activer la RLS sur une table sans policy SELECT existante BLOQUE toute
-- lecture. Si tes tables ont déjà des policies SELECT, ajoute simplement les
-- policies ci-dessous (elles RESTREIGNENT le ghost). Si une table n'a PAS de
-- RLS aujourd'hui, n'exécute PAS le bloc la concernant tant que tu n'as pas
-- recréé une policy SELECT « normale » — sinon tu casses l'accès.
--
-- Teste table par table.
--
-- IDs (en dur, comme dans le code) :
--   admin : 13cdb485-42e0-48df-b2f8-14dc77dd895a
--   ghost : da8f0dfc-a63e-4fc3-a547-1558b638f057

-- Helper : true si l'utilisateur courant est l'admin
create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select auth.uid() = '13cdb485-42e0-48df-b2f8-14dc77dd895a'::uuid
$$;

-- ── PROFIL ───────────────────────────────────────────────────────────────
-- Le profil du ghost n'est visible que par l'admin.
drop policy if exists "hide ghost profile" on public.profiles;
create policy "hide ghost profile"
  on public.profiles for select
  using (
    id <> 'da8f0dfc-a63e-4fc3-a547-1558b638f057'::uuid
    or public.is_admin()
  );

-- ── POSTS ────────────────────────────────────────────────────────────────
drop policy if exists "hide ghost posts" on public.posts;
create policy "hide ghost posts"
  on public.posts for select
  using (
    author_id <> 'da8f0dfc-a63e-4fc3-a547-1558b638f057'::uuid
    or public.is_admin()
  );

-- ── COMMENTAIRES ─────────────────────────────────────────────────────────
drop policy if exists "hide ghost comments" on public.comments;
create policy "hide ghost comments"
  on public.comments for select
  using (
    author_id <> 'da8f0dfc-a63e-4fc3-a547-1558b638f057'::uuid
    or public.is_admin()
  );

-- ── RÉACTIONS ────────────────────────────────────────────────────────────
drop policy if exists "hide ghost reactions" on public.reactions;
create policy "hide ghost reactions"
  on public.reactions for select
  using (
    author_id <> 'da8f0dfc-a63e-4fc3-a547-1558b638f057'::uuid
    or public.is_admin()
  );

-- ── MESSAGES DU QG ───────────────────────────────────────────────────────
drop policy if exists "hide ghost qg messages" on public.qg_messages;
create policy "hide ghost qg messages"
  on public.qg_messages for select
  using (
    user_id <> 'da8f0dfc-a63e-4fc3-a547-1558b638f057'::uuid
    or public.is_admin()
  );

-- ── PRÉSENCE QG (membres en ligne) ───────────────────────────────────────
drop policy if exists "hide ghost qg presence" on public.qg_presence;
create policy "hide ghost qg presence"
  on public.qg_presence for select
  using (
    user_id <> 'da8f0dfc-a63e-4fc3-a547-1558b638f057'::uuid
    or public.is_admin()
  );

-- ── FORUM ────────────────────────────────────────────────────────────────
drop policy if exists "hide ghost forum topics" on public.forum_topics;
create policy "hide ghost forum topics"
  on public.forum_topics for select
  using (
    author_id <> 'da8f0dfc-a63e-4fc3-a547-1558b638f057'::uuid
    or public.is_admin()
  );

drop policy if exists "hide ghost forum replies" on public.forum_replies;
create policy "hide ghost forum replies"
  on public.forum_replies for select
  using (
    author_id <> 'da8f0dfc-a63e-4fc3-a547-1558b638f057'::uuid
    or public.is_admin()
  );

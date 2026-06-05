-- Position verticale du cadrage des images (0 = haut, 50 = centre, 100 = bas).
-- À exécuter dans l'éditeur SQL de Supabase.

alter table public.service_items
  add column if not exists image_position int not null default 50;

alter table public.portfolio_items
  add column if not exists image_position int not null default 50;

alter table public.events
  add column if not exists cover_position int not null default 50;

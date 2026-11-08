-- Un hôtel par joueur. L'état complet du jeu est un JSON (le même que la
-- sauvegarde locale) ; quelques colonnes en sont extraites pour le classement.
-- Écriture : uniquement par l'Edge Function `act` (clé serveur), jamais par le
-- navigateur. Lecture : chacun la sienne (le classement viendra avec le social).

create table if not exists public.hotels (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  state       jsonb       not null,
  version     bigint      not null default 0,      -- verrou optimiste (une écriture à la fois)
  hotel_name  text        not null default '',
  level       int         not null default 1,
  prestige    int         not null default 0,
  stars       int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.hotels enable row level security;

drop policy if exists "Lire son hôtel" on public.hotels;
create policy "Lire son hôtel" on public.hotels
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Aucune politique insert / update / delete : le navigateur ne peut rien écrire.

create index if not exists hotels_prestige_idx on public.hotels (prestige desc);

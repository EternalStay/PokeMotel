-- Social : code ami, amitiés, mur de l'hôtel (messages et « j'aime »).
-- Comme pour `hotels`, tout passe par l'Edge Function `act` (clé serveur) :
-- RLS activée et aucune politique, le navigateur ne lit ni n'écrit ces tables.

-- Code ami : 8 caractères tirés de l'identifiant du compte (stable, partageable).
alter table public.hotels
  add column if not exists friend_code text
  generated always as (upper(substr(replace(user_id::text, '-', ''), 1, 8))) stored;
create unique index if not exists hotels_friend_code_idx on public.hotels (friend_code);

-- Amitiés : une ligne par paire (user_a < user_b), en attente ou acceptée.
create table if not exists public.friendships (
  user_a       uuid not null references public.hotels (user_id) on delete cascade,
  user_b       uuid not null references public.hotels (user_id) on delete cascade,
  requested_by uuid not null,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_b_idx on public.friendships (user_b);
alter table public.friendships enable row level security;

-- Mur : messages laissés sur un hôtel.
create table if not exists public.wall_posts (
  id         bigint generated always as identity primary key,
  owner      uuid not null references public.hotels (user_id) on delete cascade,
  author     uuid not null references public.hotels (user_id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists wall_posts_owner_idx on public.wall_posts (owner, created_at desc);
alter table public.wall_posts enable row level security;

-- « J'aime » : un par visiteur et par hôtel.
create table if not exists public.wall_likes (
  owner      uuid not null references public.hotels (user_id) on delete cascade,
  user_id    uuid not null references public.hotels (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, user_id)
);
alter table public.wall_likes enable row level security;

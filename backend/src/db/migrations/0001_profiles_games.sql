-- Profiles, games and game versions.
-- age_band is under13, 13to17 or adult. Only the birth year is stored, never a full birthday.

create type age_band as enum ('under13', '13to17', 'adult');
create type plan as enum ('free', 'paid');
create type game_status as enum ('draft', 'published', 'hidden', 'removed');
create type game_visibility as enum ('private', 'public');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  birth_year integer not null check (birth_year between 1900 and 2100),
  age_band age_band not null,
  country text,
  plan plan not null default 'free',
  created_at timestamptz not null default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  title text not null default '',
  description text not null default '',
  tags text[] not null default '{}',
  status game_status not null default 'draft',
  visibility game_visibility not null default 'private',
  allow_download boolean not null default false,
  license text not null default 'all-rights-reserved',
  current_version_id uuid,
  like_count integer not null default 0 check (like_count >= 0),
  staff_pick boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- HTML lives in Storage (html_path). The last 5 versions per game are kept.
create table game_versions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  prompt text not null,
  html_path text not null,
  size_bytes integer not null check (size_bytes >= 0),
  model text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  error_log text,
  created_at timestamptz not null default now()
);

alter table games
  add constraint games_current_version_fk
  foreign key (current_version_id) references game_versions (id) on delete set null;

create index games_owner_idx on games (owner_id, created_at desc);
create index games_gallery_idx on games (status, visibility, published_at desc);
create index game_versions_game_idx on game_versions (game_id, created_at desc);

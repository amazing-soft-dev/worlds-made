-- Daily usage limits, likes (one per user per game) and reports (feed the admin queue).

create table build_usage (
  user_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  builds_used integer not null default 0 check (builds_used >= 0),
  repairs_used integer not null default 0 check (repairs_used >= 0),
  primary key (user_id, date)
);

create table likes (
  user_id uuid not null references profiles (id) on delete cascade,
  game_id uuid not null references games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  reporter_id uuid not null references profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (game_id, reporter_id)
);

create index likes_game_idx on likes (game_id, created_at desc);
create index reports_queue_idx on reports (status, created_at);

-- Daily challenges, scores, streaks, subscriptions and the recommendation cache.

-- One row per UTC day once scheduled. A null date is an approved backlog entry waiting for a day.
create table daily_challenges (
  id uuid primary key default gen_random_uuid(),
  date date unique,
  game_version_id uuid not null references game_versions (id) on delete restrict,
  theme text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'used')),
  approved_by uuid references profiles (id),
  score_min numeric not null default 0,
  score_max numeric not null,
  created_at timestamptz not null default now(),
  check (score_max > score_min)
);

-- Signed-in players have user_id; anonymous players (and every under-13) have only an anonymous id.
create table challenge_scores (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  user_id uuid references profiles (id) on delete cascade,
  anon_id text,
  score numeric not null,
  created_at timestamptz not null default now(),
  check ((user_id is not null) <> (anon_id is not null))
);
create unique index challenge_scores_user_day on challenge_scores (date, user_id) where user_id is not null;
create unique index challenge_scores_anon_day on challenge_scores (date, anon_id) where anon_id is not null;
create index challenge_scores_board on challenge_scores (date, score desc);

create table streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete cascade,
  anon_id text,
  current integer not null default 0 check (current >= 0),
  best integer not null default 0 check (best >= 0),
  last_played_date date,
  check ((user_id is not null) <> (anon_id is not null))
);
create unique index streaks_user on streaks (user_id) where user_id is not null;
create unique index streaks_anon on streaks (anon_id) where anon_id is not null;

-- Written only by the Stripe webhook.
create table subscriptions (
  user_id uuid primary key references profiles (id) on delete cascade,
  stripe_customer_id text not null,
  status text not null,
  current_period_end timestamptz
);

-- 24-hour cache of RAWG results.
create table rec_cache (
  query_hash text primary key,
  filters_json jsonb not null,
  results_json jsonb not null,
  expires_at timestamptz not null
);
create index rec_cache_expiry on rec_cache (expires_at);

-- One row per model call, so the dashboard shows real cost per build and the monthly spend cap survives restarts.

create table llm_calls (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('generate', 'repair', 'change', 'parse', 'explain', 'daily')),
  model text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  user_id uuid references profiles (id) on delete set null,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index llm_calls_month on llm_calls (created_at);

-- Server only: no policy, so clients can read and write nothing.
alter table llm_calls enable row level security;
revoke all on llm_calls from anon, authenticated;

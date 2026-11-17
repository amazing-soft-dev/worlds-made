-- Row-level security for every table.
--
-- The backend uses the service-role key, which bypasses RLS, so it is the only writer of moderated state
-- (publishing, likes, reports, scores, usage, subscriptions). These policies are defence in depth for any
-- direct client access: people read their own rows, public games and the leaderboard, and may only edit
-- their own private drafts. Nothing here lets a client write usage, scores, subscriptions or the cache.

alter table profiles enable row level security;
alter table games enable row level security;
alter table game_versions enable row level security;
alter table build_usage enable row level security;
alter table likes enable row level security;
alter table reports enable row level security;
alter table daily_challenges enable row level security;
alter table challenge_scores enable row level security;
alter table streaks enable row level security;
alter table subscriptions enable row level security;
alter table rec_cache enable row level security;

-- profiles: your own row only.
create policy profiles_select_own on profiles for select using (id = auth.uid());

-- games: public published games are readable by anyone; owners see and edit their own drafts.
create policy games_select_public on games for select
  using (status = 'published' and visibility = 'public');
create policy games_select_own on games for select using (owner_id = auth.uid());
create policy games_insert_own_draft on games for insert
  with check (owner_id = auth.uid() and status = 'draft' and visibility = 'private' and like_count = 0 and staff_pick = false);
create policy games_update_own_draft on games for update
  using (owner_id = auth.uid() and status = 'draft')
  with check (owner_id = auth.uid() and status = 'draft' and visibility = 'private' and like_count = 0 and staff_pick = false);
create policy games_delete_own_draft on games for delete
  using (owner_id = auth.uid() and status = 'draft');

-- game_versions: readable by the game's owner. Written by the backend only.
create policy game_versions_select_own on game_versions for select
  using (exists (select 1 from games g where g.id = game_versions.game_id and g.owner_id = auth.uid()));

-- build_usage, likes, streaks, subscriptions: your own rows, read only.
create policy build_usage_select_own on build_usage for select using (user_id = auth.uid());
create policy likes_select_own on likes for select using (user_id = auth.uid());
create policy streaks_select_own on streaks for select using (user_id = auth.uid());
create policy subscriptions_select_own on subscriptions for select using (user_id = auth.uid());

-- reports: you can see what you reported; nobody else's.
create policy reports_select_own on reports for select using (reporter_id = auth.uid());

-- daily challenges: only approved ones that have been scheduled for today or earlier.
create policy daily_challenges_select_live on daily_challenges for select
  using (status in ('approved', 'used') and date is not null and date <= (now() at time zone 'utc')::date);

-- challenge_scores: the leaderboard is public (display names only, resolved by the backend).
create policy challenge_scores_select_all on challenge_scores for select using (true);

-- rec_cache: no policy, so clients can read and write nothing. The backend uses the service role.

-- Belt and braces: strip write privileges the policies above do not grant.
revoke insert, update, delete on profiles, game_versions, build_usage, likes, reports,
  daily_challenges, challenge_scores, streaks, subscriptions, rec_cache from anon, authenticated;
revoke all on rec_cache from anon, authenticated;
-- Owners may only change these columns of a draft; status, like_count and staff_pick are server-controlled.
revoke update on games from anon, authenticated;
grant update (title, description, tags, allow_download, license) on games to authenticated;

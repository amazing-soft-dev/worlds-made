import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TABLES } from '../src/db/tables';

const dir = new URL('../src/db/migrations/', import.meta.url);
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(new URL(f, dir), 'utf8'))
  .join('\n');

/** Policies parsed as { table, command } pairs. */
const policies = [...sql.matchAll(/create policy \w+ on (\w+) for (select|insert|update|delete|all)/g)].map((m) => ({
  table: m[1] as string,
  command: m[2] as string,
}));

const commandsFor = (table: string) => policies.filter((p) => p.table === table).map((p) => p.command);

test('row-level security is enabled on every table', () => {
  for (const t of TABLES) {
    assert.match(sql, new RegExp(`alter table ${t} enable row level security`), `RLS missing on ${t}`);
  }
});

test('no policy grants a client write on server-controlled tables', () => {
  const serverOnly = ['profiles', 'game_versions', 'build_usage', 'likes', 'reports', 'daily_challenges', 'challenge_scores', 'streaks', 'subscriptions', 'rec_cache', 'llm_calls'];
  for (const t of serverOnly) {
    const writes = commandsFor(t).filter((c) => c !== 'select');
    assert.deepEqual(writes, [], `${t} must be read-only for clients, found ${writes.join(',')}`);
  }
});

test('rec_cache and llm_calls have no policy at all', () => {
  assert.deepEqual(commandsFor('rec_cache'), []);
  assert.deepEqual(commandsFor('llm_calls'), []);
});

test('drafts are the only games a client can write, and cannot be published or boosted', () => {
  const insert = sql.match(/create policy games_insert_own_draft[\s\S]*?;/)?.[0] ?? '';
  const update = sql.match(/create policy games_update_own_draft[\s\S]*?;/)?.[0] ?? '';
  for (const policy of [insert, update]) {
    assert.match(policy, /status = 'draft'/);
    assert.match(policy, /visibility = 'private'/);
    assert.match(policy, /like_count = 0/);
    assert.match(policy, /staff_pick = false/);
  }
  assert.match(sql, /grant update \(title, description, tags, allow_download, license\) on games to authenticated/);
});

test('reads are limited to your own rows, public games, live challenges and the board', () => {
  assert.match(sql, /profiles_select_own on profiles for select using \(id = auth\.uid\(\)\)/);
  assert.match(sql, /games_select_public[\s\S]*status = 'published' and visibility = 'public'/);
  assert.match(sql, /subscriptions_select_own on subscriptions for select using \(user_id = auth\.uid\(\)\)/);
  assert.match(sql, /daily_challenges_select_live[\s\S]*date <= /);
});

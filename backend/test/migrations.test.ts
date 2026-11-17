import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TABLES } from '../src/db/tables';

const dir = new URL('../src/db/migrations/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const sql = files.map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');

test('migrations are numbered and applied in order', () => {
  assert.ok(files.length >= 3);
  files.forEach((f, i) => assert.ok(f.startsWith(String(i + 1).padStart(4, '0') + '_'), `${f} is out of order`));
});

test('every table in the data model has a create table statement', () => {
  for (const t of TABLES) {
    assert.match(sql, new RegExp(`create table ${t} \\(`), `missing create table ${t}`);
  }
});

test('no extra tables exist that the code does not know about', () => {
  const created = [...sql.matchAll(/create table (\w+) \(/g)].map((m) => m[1]);
  assert.deepEqual([...created].sort(), [...TABLES].sort());
});

test('age is stored as a birth year and a band only', () => {
  assert.match(sql, /birth_year integer/);
  assert.doesNotMatch(sql, /birth_?date|date_of_birth/i);
});

test('likes and reports are one per user per game', () => {
  assert.match(sql, /create table likes[\s\S]*primary key \(user_id, game_id\)/);
  assert.match(sql, /create table reports[\s\S]*unique \(game_id, reporter_id\)/);
});

test('a score belongs to a user or an anonymous id, never both', () => {
  assert.match(sql, /check \(\(user_id is not null\) <> \(anon_id is not null\)\)/);
});

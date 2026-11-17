import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ageBandFromBirthYear, effectiveAgeBand, parseGameMessage, LIMITS } from '../src/index';

test('parseGameMessage accepts score and error only', () => {
  assert.deepEqual(parseGameMessage({ type: 'score', value: 42 }), { type: 'score', value: 42 });
  assert.deepEqual(parseGameMessage({ type: 'error', message: 'boom' }), { type: 'error', message: 'boom' });
  assert.equal(parseGameMessage({ type: 'navigate', url: 'https://evil.example' }), null);
  assert.equal(parseGameMessage({ type: 'score', value: Number.NaN }), null);
  assert.equal(parseGameMessage({ type: 'score', value: '9' }), null);
  assert.equal(parseGameMessage(null), null);
  assert.equal(parseGameMessage('score'), null);
});

test('age band uses the youngest possible age for the birth year', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  assert.equal(ageBandFromBirthYear(2015, now), 'under13'); // youngest 10
  assert.equal(ageBandFromBirthYear(2013, now), 'under13'); // youngest 12
  assert.equal(ageBandFromBirthYear(2012, now), '13to17'); // youngest 13
  assert.equal(ageBandFromBirthYear(2009, now), '13to17'); // youngest 16
  assert.equal(ageBandFromBirthYear(2008, now), '13to17'); // youngest 17
  assert.equal(ageBandFromBirthYear(2007, now), 'adult'); // youngest 18
});

test('unknown age is treated as under 13', () => {
  assert.equal(effectiveAgeBand(undefined), 'under13');
  assert.equal(effectiveAgeBand(null), 'under13');
  assert.equal(effectiveAgeBand('adult'), 'adult');
});

test('limits match the spec', () => {
  assert.equal(LIMITS.maxGameBytes, 204800);
  assert.equal(LIMITS.reportsToHide, 3);
  assert.equal(LIMITS.leaderboardSize, 100);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseGameMessage } from '../src/score-message';

/** Everything a hostile game might try to post to the parent page. Only an exact score or error may pass. */
const HOSTILE: unknown[] = [
  undefined,
  null,
  0,
  'score',
  [],
  {},
  { type: 'score' },
  { type: 'score', value: NaN },
  { type: 'score', value: Infinity },
  { type: 'score', value: '100' },
  { type: 'score', value: { valueOf: () => 1 } },
  { type: 'SCORE', value: 1 },
  { type: 'navigate', url: 'https://evil.example' },
  { type: 'eval', code: 'alert(1)' },
  { type: 'error', message: 'x'.repeat(501) },
  { type: 'error', message: { toString: () => 'x' } },
  { __proto__: { type: 'score', value: 1 } },
  JSON.parse('{"type":"score","value":1,"__proto__":{"admin":true}}'),
];

test('hostile payloads are rejected or stripped, never trusted', () => {
  for (const data of HOSTILE) {
    const out = parseGameMessage(data);
    if (out === null) continue;
    // The only thing allowed through is a clean score or error object with no extra keys.
    assert.ok(out.type === 'score' || out.type === 'error');
    assert.deepEqual(Object.keys(out).filter((k) => !['type', 'value', 'message'].includes(k)), [], JSON.stringify(data));
    assert.equal(({} as Record<string, unknown>).admin, undefined, 'no prototype pollution');
  }
});

test('valid messages pass exactly', () => {
  assert.deepEqual(parseGameMessage({ type: 'score', value: 12.5 }), { type: 'score', value: 12.5 });
  assert.deepEqual(parseGameMessage({ type: 'error' }), { type: 'error' });
  assert.deepEqual(parseGameMessage({ type: 'error', message: 'oops' }), { type: 'error', message: 'oops' });
});

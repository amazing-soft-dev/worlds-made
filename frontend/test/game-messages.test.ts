import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptGameMessage } from '../src/lib/game-messages';

const frame = { name: 'the game frame' };
const ev = (over: Partial<{ source: unknown; origin: string; data: unknown }> = {}) => ({ source: frame, origin: 'null', data: { type: 'score', value: 42 }, ...over });

test('a score or error from the game frame is accepted', () => {
  assert.deepEqual(acceptGameMessage(ev(), frame), { type: 'score', value: 42 });
  assert.deepEqual(acceptGameMessage(ev({ data: { type: 'error', message: 'oops' } }), frame), { type: 'error', message: 'oops' });
});

test('messages from any other window are ignored', () => {
  assert.equal(acceptGameMessage(ev({ source: { name: 'another frame' } }), frame), null);
  assert.equal(acceptGameMessage(ev({ source: null }), frame), null);
  assert.equal(acceptGameMessage(ev(), null), null);
});

test('messages from a real origin are ignored: only the sandbox\'s opaque origin counts', () => {
  assert.equal(acceptGameMessage(ev({ origin: 'https://evil.example' }), frame), null);
  assert.equal(acceptGameMessage(ev({ origin: 'https://games.example' }), frame), null);
});

test('anything that is not exactly a score or an error is ignored', () => {
  for (const data of [{ type: 'navigate', url: 'https://evil.example' }, { type: 'score' }, { type: 'score', value: 'lots' }, { type: 'score', value: Infinity }, 'score', null, 42, [], { value: 1 }]) {
    assert.equal(acceptGameMessage(ev({ data }), frame), null, JSON.stringify(data));
  }
});

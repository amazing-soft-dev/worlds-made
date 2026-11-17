import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findBlocked, normalise } from '../src/services/moderation/blocklist';
import { rewriteFranchises } from '../src/services/moderation/franchise';
import { FakeModerator, OpenAiModerator } from '../src/services/moderation/moderator';
import { ModerationService } from '../src/services/moderation/service';

const svc = new ModerationService(new FakeModerator(), ['badword']);

test('normalisation removes accents, case, punctuation and letter swaps', () => {
  assert.equal(normalise('  N@KED!! '), ' nakeD '.toLowerCase());
  assert.equal(normalise('Pokémon-Fan'), ' pokemon fan ');
});

test('blocklist catches adult, violence, real people and extra terms, but not look-alike words', () => {
  assert.equal(findBlocked('a P0RN game')?.category, 'adult');
  assert.equal(findBlocked('lots of gore')?.category, 'violence');
  assert.equal(findBlocked('a game about Elon  Musk')?.category, 'realPeople');
  assert.equal(findBlocked('this is a BADWORD', ['badword'])?.category, 'extra');
  assert.equal(findBlocked('a sextant puzzle on a classic essex coast'), null);
  assert.equal(findBlocked('a cute space runner'), null);
});

test('franchise names become original stand-ins and are reported', () => {
  const r = rewriteFranchises('a Mario clone where Pikachu collects coins');
  assert.equal(r.swaps.length, 2);
  assert.match(r.text, /jumping plumber-style hero, original design/);
  assert.doesNotMatch(r.text, /mario|pikachu/i);
  assert.deepEqual(rewriteFranchises('a match-3 puzzle').swaps, []);
});

test('prompts: blocked, rewritten, or flagged by the classifier', async () => {
  assert.deepEqual((await svc.checkPrompt('a porn game')).allowed, false);
  const ok = await svc.checkPrompt('play as sonic collecting rings');
  assert.equal(ok.allowed, true);
  if (ok.allowed) assert.equal(ok.swaps.length, 1);
  const flagged = await svc.checkPrompt('something [[flag]]');
  assert.equal(flagged.allowed, false);
  if (!flagged.allowed) assert.equal(flagged.reason, 'flagged');
});

test('text and display names use the same rules', async () => {
  assert.equal((await svc.checkText('Cute Frog Hop')).allowed, true);
  assert.equal((await svc.checkText('gory fun')).allowed, false);
  assert.equal((await svc.checkText('')).allowed, true);
  assert.equal(svc.checkDisplayName('Naked Fan').allowed, false);
  assert.equal(svc.checkDisplayName('Maple Fan').allowed, true);
});

test('the OpenAI adapter sends the key and maps flagged categories', async () => {
  let seen: { url: string; auth: string } | null = null;
  const f = (async (url: string, init: RequestInit) => {
    seen = { url, auth: (init.headers as Record<string, string>).authorization as string };
    return new Response(JSON.stringify({ results: [{ flagged: true, categories: { violence: true, sexual: false } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await new OpenAiModerator('sk-test', f).check('x');
  assert.deepEqual(r, { flagged: true, categories: ['violence'] });
  assert.deepEqual(seen, { url: 'https://api.openai.com/v1/moderations', auth: 'Bearer sk-test' });
  const down = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(new OpenAiModerator('k', down).check('x'));
});

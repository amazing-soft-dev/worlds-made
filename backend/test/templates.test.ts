import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { FakeLlm } from '../src/adapters/llm/fake';
import { buildUserPrompt, extractHtml, GAME_SYSTEM_PROMPT } from '../src/services/games/prompts';
import { scanGameHtml } from '../src/services/scanner';
import { GENRES, pickGenre, renderTemplate, safeTitle, type Genre } from '../src/services/games/templates';

test('every template passes the static scanner with no warnings', () => {
  for (const g of GENRES) {
    const html = renderTemplate(g, 'Comet Dash');
    const r = scanGameHtml(html);
    assert.deepEqual(r.problems, [], `${g}: ${r.problems.join(', ')}`);
    assert.deepEqual(r.warnings, [], `${g}: ${r.warnings.join(', ')}`);
    assert.ok(r.bytes < 20_000, `${g} is ${r.bytes} bytes`);
  }
});

/** Runs a template's script against stub browser objects and plays frames with no input. */
function play(genre: Genre, maxFrames: number) {
  const html = renderTemplate(genre, 'Test Game');
  const code = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  const handlers: Record<string, Array<(e: Record<string, unknown>) => void>> = {};
  const on = (type: string, fn: (e: Record<string, unknown>) => void) => (handlers[type] ??= []).push(fn);
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
  const canvas = { width: 360, height: 540, getContext: () => ctx, addEventListener: on, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 540 }) };
  const raf: { fn: (() => void) | null } = { fn: null };
  const messages: unknown[] = [];
  const sandbox = {
    document: { getElementById: () => canvas },
    addEventListener: on,
    requestAnimationFrame: (fn: () => void) => { raf.fn = fn; return 1; },
    parent: { postMessage: (m: unknown) => messages.push(m) },
    Math,
    parseInt,
  };
  new vm.Script(code).runInNewContext(sandbox);
  const fire = (type: string, e: Record<string, unknown>) => (handlers[type] ?? []).forEach((h) => h(e));
  fire('keydown', { key: ' ', preventDefault() {} }); // start
  for (let i = 0; i < maxFrames && messages.length === 0; i++) raf.fn?.();
  return { messages, fire, next: () => raf.fn?.() };
}

for (const g of GENRES) {
  test(`${g}: the script compiles, starts on Space, and ends with a score report when left alone`, () => {
    const { messages } = play(g, 30_000);
    assert.equal(messages.length, 1, `${g} never reported a score`);
    const m = messages[0] as { type: string; value: number };
    assert.equal(m.type, 'score');
    assert.ok(Number.isFinite(m.value) && m.value >= 0);
  });
}

test('the quiz scores a correct answer by key press', () => {
  const { fire, next, messages } = play('quiz', 3);
  assert.equal(messages.length, 0);
  // Keep answering 1..4 until the game ends; the loop must stay alive and the score stay a number.
  for (let i = 0; i < 400 && messages.length === 0; i++) { fire('keydown', { key: String((i % 4) + 1), preventDefault() {} }); next(); }
  assert.equal(messages.length, 1);
});

test('genre is picked from the request, and titles are made safe', () => {
  assert.equal(pickGenre('a space shooter with aliens'), 'shooter');
  assert.equal(pickGenre('a maths quiz'), 'quiz');
  assert.equal(pickGenre('catch falling stars'), 'catcher');
  assert.equal(pickGenre('a cat that jumps over fences'), 'runner');
  assert.equal(safeTitle(`</title><script>alert(1)</script>`), 'titlescriptalert1script');
  assert.equal(safeTitle('   '), 'My Game');
  assert.ok(!renderTemplate('runner', `'; evil(); '`).includes('evil();'));
});

test('prompts carry the rules and the template, and repair carries the errors', () => {
  assert.match(GAME_SYSTEM_PROMPT, /single HTML file/);
  assert.match(GAME_SYSTEM_PROMPT, /parent\.postMessage/);
  const gen = buildUserPrompt({ kind: 'generate', genre: 'runner', request: 'a frog that hops' });
  assert.match(gen, /TEMPLATE:/);
  assert.match(gen, /a frog that hops/);
  const fix = buildUserPrompt({ kind: 'repair', genre: 'runner', request: '', currentHtml: '<html>x</html>', errors: ['ReferenceError: nope'] });
  assert.match(fix, /ReferenceError: nope/);
  assert.match(fix, /<html>x<\/html>/);
});

test('HTML is extracted from fenced and bare replies, and refused when absent', () => {
  assert.equal(extractHtml('here you go\n```html\n<!doctype html><html></html>\n```\nenjoy'), '<!doctype html><html></html>');
  assert.equal(extractHtml('<html><body>x</body></html> trailing'), '<html><body>x</body></html>');
  assert.equal(extractHtml('sorry, I cannot do that'), null);
});

test('the fake model returns a fenced template that survives extraction and scanning', async () => {
  const llm = new FakeLlm();
  const r = await llm.complete({ purpose: 'generate', system: GAME_SYSTEM_PROMPT, user: buildUserPrompt({ kind: 'generate', genre: 'catcher', request: 'catch falling stars' }), maxOutputTokens: 1000, timeoutMs: 1000 });
  const html = extractHtml(r.text);
  assert.ok(html);
  assert.equal(scanGameHtml(html ?? '').ok, true);
  assert.ok(r.tokensIn > 0 && r.tokensOut > 0);
});

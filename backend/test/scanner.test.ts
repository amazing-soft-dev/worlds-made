import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractVisibleText, scanGameHtml } from '../src/services/scanner';

const CLEAN = `<!doctype html><html><body><canvas id="c" width="320" height="480"></canvas>
<script>
const ctx = document.getElementById('c').getContext('2d');
let score = 0;
addEventListener('keydown', () => score++);
addEventListener('pointerdown', () => score++);
function end() { parent.postMessage({ type: 'score', value: score }, '*'); }
const msg = 'Tap to jump over the comets';
</script></body></html>`;

test('a clean canvas game passes without warnings', () => {
  const r = scanGameHtml(CLEAN);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.ok, true);
});

const wrap = (js: string) => `<html><body><canvas></canvas><script>${js}</script></body></html>`;

const HOSTILE: Array<[string, string]> = [
  ['fetch', wrap("fetch('/steal')")],
  ['XMLHttpRequest', wrap('new XMLHttpRequest()')],
  ['WebSocket', wrap("new WebSocket('wss://x')")],
  ['external URL', wrap("const u = 'https://evil.example/x.js'")],
  ['external script', '<html><body><script src="/x.js"></script></body></html>'],
  ['eval', wrap("eval('1+1')")],
  ['Function constructor', wrap("new Function('return 1')()")],
  ['timer with a string', wrap("setTimeout('doBad()', 10)")],
  ['cookie', wrap('const c = document.cookie')],
  ['localStorage', wrap("localStorage.setItem('a','b')")],
  ['window.open', wrap("window.open('x')")],
  ['top window', wrap('top.location = "x"')],
  ['navigation', wrap("location.href = 'x'")],
  ['computed global', wrap("window['fe'+'tch']('x')")],
  ['computed banned API', wrap("self['eval']('1')")],
  ['iframe', '<html><body><iframe></iframe></body></html>'],
  ['form', '<html><body><form action="x"></form></body></html>'],
  ['sendBeacon', wrap("navigator.sendBeacon('x')")],
  ['dynamic import', wrap("import('x')")],
  ['css @import', '<html><head><style>@import "x.css";</style></head><body></body></html>'],
  ['css url()', '<html><head><style>body{background:url(/x.png)}</style></head><body></body></html>'],
  ['protocol-relative', '<html><body><img src="//evil.example/a.png"></body></html>'],
];

for (const [name, html] of HOSTILE) {
  test(`rejects ${name}`, () => {
    const r = scanGameHtml(html);
    assert.equal(r.ok, false, `expected ${name} to be rejected`);
    assert.ok(r.problems.length >= 1);
  });
}

test('SVG namespaces and data URIs are allowed', () => {
  const html = wrap(`const svg = "<svg xmlns='http://www.w3.org/2000/svg'></svg>"; const img = 'data:image/png;base64,AAAA'; parent.postMessage({type:'score',value:1},'*'); addEventListener('keydown',()=>{}); addEventListener('click',()=>{});`);
  assert.equal(scanGameHtml(html).ok, true);
});

test('files over the size cap are rejected, and non-HTML is rejected', () => {
  assert.equal(scanGameHtml(wrap('x'.repeat(210 * 1024))).ok, false);
  assert.equal(scanGameHtml('just some text').ok, false);
});

test('visible strings are extracted for moderation', () => {
  const t = extractVisibleText('<html><title>Comet Run</title><body><button>Start now</button><script>const a = "Game over, try again"; const b = "xy"; const k = "a_b_c_d";</script></body></html>');
  assert.ok(t.includes('Comet Run'));
  assert.ok(t.includes('Start now'));
  assert.ok(t.includes('Game over, try again'));
  assert.ok(!t.includes('xy'));
  assert.ok(!t.includes('a_b_c_d'));
});

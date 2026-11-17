import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import Fastify from 'fastify';
import { genReqId, REDACT_PATHS } from '../src/lib/logger';

/** A Fastify app whose logs go into an array, using the same redaction paths and id generator as the real one. */
function appWithLogCapture() {
  const lines: string[] = [];
  const stream = new Writable({ write(chunk, _enc, done) { lines.push(String(chunk)); done(); } });
  const app = Fastify({ logger: { level: 'info', stream, redact: { paths: REDACT_PATHS, censor: '[redacted]' } }, genReqId, requestIdHeader: false });
  app.get('/x', async (req) => {
    req.log.info({ token: 'tok_secret_value', apiKey: 'sk_live_secret' }, 'with secrets');
    return { ok: true };
  });
  return { app, lines };
}

test('authorization, cookies and stripe signatures never reach the logs', async () => {
  const { app, lines } = appWithLogCapture();
  await app.inject({
    method: 'GET',
    url: '/x',
    headers: { authorization: 'Bearer eyJhbGciOi.secret.jwt', cookie: 'wm_age=2010|DE.sig; wm_anon=a_secret', 'stripe-signature': 't=1,v1=secretsig' },
  });
  await app.close();
  const all = lines.join('\n');
  assert.ok(all.includes('[redacted]'), 'redaction should be visible in the log');
  for (const secret of ['eyJhbGciOi', 'wm_age=2010', 'a_secret', 'secretsig', 'tok_secret_value', 'sk_live_secret']) {
    assert.ok(!all.includes(secret), `${secret} must not appear in logs`);
  }
});

test('a sane incoming request id is reused and a hostile one is replaced', () => {
  assert.equal(genReqId({ headers: { 'x-request-id': 'trace-12345678' } }), 'trace-12345678');
  const fresh = genReqId({ headers: { 'x-request-id': 'bad id with spaces and <script>' } });
  assert.match(fresh, /^[0-9a-f-]{36}$/);
  assert.match(genReqId({ headers: {} }), /^[0-9a-f-]{36}$/);
  assert.match(genReqId({ headers: { 'x-request-id': ['a'.repeat(100)] } }), /^[0-9a-f-]{36}$/, 'too long');
});

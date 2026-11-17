import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryMailer, oneLine, ResendMailer } from '../src/adapters/mail/mailer';
import { loadConfig } from '../src/config';

const msg = { name: 'Sam', email: 'sam@example.com', message: 'Hello, I love the daily challenge!' };

function setup() {
  const mailer = new MemoryMailer();
  const app = buildApp({ config: loadConfig({ MAIL_TO: 'inbox@worldsmade.example' }), services: { mailer } });
  return { app, mailer };
}

test('a contact message is emailed to the inbox with the sender as reply-to', async () => {
  const { app, mailer } = setup();
  const res = await app.inject({ method: 'POST', url: '/api/contact', payload: msg });
  assert.equal(res.statusCode, 202);
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0]?.to, 'inbox@worldsmade.example');
  assert.equal(mailer.sent[0]?.replyTo, 'sam@example.com');
  assert.match(mailer.sent[0]?.text ?? '', /love the daily challenge/);
  await app.close();
});

test('the honeypot field gets the same answer but sends nothing', async () => {
  const { app, mailer } = setup();
  const res = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...msg, website: 'http://spam.example' } });
  assert.equal(res.statusCode, 202);
  assert.equal(mailer.sent.length, 0);
  await app.close();
});

test('invalid input is a 400 and nothing is sent', async () => {
  const { app, mailer } = setup();
  for (const payload of [{}, { ...msg, email: 'nope' }, { ...msg, message: 'short' }, { ...msg, name: '' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/contact', payload })).statusCode, 400);
  }
  assert.equal(mailer.sent.length, 0);
  await app.close();
});

test('five messages an hour per IP, then 429 with Retry-After', async () => {
  const { app, mailer } = setup();
  for (let i = 0; i < 5; i++) assert.equal((await app.inject({ method: 'POST', url: '/api/contact', payload: msg })).statusCode, 202);
  const res = await app.inject({ method: 'POST', url: '/api/contact', payload: msg });
  assert.equal(res.statusCode, 429);
  assert.ok(Number(res.headers['retry-after']) > 0);
  assert.equal(mailer.sent.length, 5);
  await app.close();
});

test('line breaks in the name cannot inject headers', async () => {
  const { app, mailer } = setup();
  await app.inject({ method: 'POST', url: '/api/contact', payload: { ...msg, name: 'Sam\r\nBcc: evil@example.com' } });
  assert.ok(!mailer.sent[0]?.subject.includes('\n'));
  assert.equal(oneLine('a\r\nb'), 'a b');
  await app.close();
});

test('the Resend adapter posts the right request', async () => {
  const seen: Array<{ url: string; auth: string; body: Record<string, unknown> }> = [];
  const f = (async (url: string, init: RequestInit) => {
    seen.push({ url, auth: (init.headers as Record<string, string>).authorization as string, body: JSON.parse(init.body as string) });
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  await new ResendMailer('re_key', 'Worlds Made <no-reply@worldsmade.example>', f).send({ to: 'a@b.c', subject: 'Hi\nthere', text: 'body', replyTo: 'x@y.z' });
  assert.equal(seen[0]?.url, 'https://api.resend.com/emails');
  assert.equal(seen[0]?.auth, 'Bearer re_key');
  assert.deepEqual(seen[0]?.body, { from: 'Worlds Made <no-reply@worldsmade.example>', to: ['a@b.c'], subject: 'Hi there', text: 'body', reply_to: 'x@y.z' });
  const down = (async () => new Response('no', { status: 422 })) as unknown as typeof fetch;
  await assert.rejects(new ResendMailer('k', 'f', down).send({ to: 'a@b.c', subject: 's', text: 't' }));
});

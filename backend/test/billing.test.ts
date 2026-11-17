import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { FakeBilling, verifyStripeSignature } from '../src/adapters/stripe/billing';
import { loadConfig } from '../src/config';
import type { ProfileRow, SubscriptionRow } from '../src/db/tables';
import { signUp } from './helpers';

const SECRET = 'whsec_test_secret';
const STRIPE_ENV = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_ID: 'price_x', SITE_URL: 'https://worldsmade.example' };

function sign(body: string, secret = SECRET, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}

function setup(env: Record<string, string> = STRIPE_ENV) {
  const store = new MemoryStore();
  const billingProvider = new FakeBilling();
  const app = buildApp({ config: loadConfig(env), services: { store, billingProvider } });
  const hook = (event: object, header?: string) => {
    const body = JSON.stringify(event);
    return app.inject({ method: 'POST', url: '/api/webhooks/stripe', headers: { 'content-type': 'application/json', 'stripe-signature': header ?? sign(body) }, payload: body });
  };
  return { app, store, billingProvider, hook };
}
const planOf = async (store: MemoryStore, id: string) => (await store.get<ProfileRow>('profiles', { id }))?.plan;

test('signatures verify only with the right secret, body and a recent timestamp', () => {
  const body = '{"a":1}';
  const now = 1_800_000_000;
  const header = sign(body, SECRET, now);
  assert.equal(verifyStripeSignature(body, header, SECRET, now), true);
  assert.equal(verifyStripeSignature(body, header, 'other', now), false);
  assert.equal(verifyStripeSignature('{"a":2}', header, SECRET, now), false);
  assert.equal(verifyStripeSignature(body, header, SECRET, now + 301), false, 'a captured request cannot be replayed later');
  assert.equal(verifyStripeSignature(body, undefined, SECRET, now), false);
  assert.equal(verifyStripeSignature(body, 't=abc,v1=00', SECRET, now), false);
});

test('an adult can start checkout and gets a hosted URL', async () => {
  const c = setup();
  const u = await signUp(c.app, { email: 'grown@example.com', yearsOld: 40 });
  const res = await c.app.inject({ method: 'POST', url: '/api/billing/checkout', headers: u.headers });
  assert.equal(res.statusCode, 200);
  assert.match((res.json() as { url: string }).url, /^https:\/\/checkout\.fake\.example\//);
  assert.deepEqual(c.billingProvider.checkouts, [{ userId: u.userId, email: 'grown@example.com' }]);
  await c.app.close();
});

test('teens are told to ask a parent, and nobody unverified or signed out can check out', async () => {
  const c = setup();
  const teen = await signUp(c.app, { yearsOld: 16 });
  const res = await c.app.inject({ method: 'POST', url: '/api/billing/checkout', headers: teen.headers });
  assert.equal(res.statusCode, 403);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'ask_a_parent');
  const unverified = await signUp(c.app, { yearsOld: 40, verified: false });
  assert.equal((await c.app.inject({ method: 'POST', url: '/api/billing/checkout', headers: unverified.headers })).statusCode, 403);
  assert.equal((await c.app.inject({ method: 'POST', url: '/api/billing/checkout' })).statusCode, 401);
  assert.equal(c.billingProvider.checkouts.length, 0);
  await c.app.close();
});

test('without Stripe configured, billing says unavailable and the webhook does not exist', async () => {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig({}), services: { store } });
  const u = await signUp(app, { yearsOld: 40 });
  assert.equal((await app.inject({ method: 'POST', url: '/api/billing/checkout', headers: u.headers })).statusCode, 503);
  assert.equal((await app.inject({ method: 'POST', url: '/api/webhooks/stripe', headers: { 'content-type': 'application/json' }, payload: '{}' })).statusCode, 404);
  await app.close();
});

test('the webhook rejects bad signatures and bad payloads and writes nothing', async () => {
  const c = setup();
  const u = await signUp(c.app, { yearsOld: 40 });
  const event = { type: 'checkout.session.completed', data: { object: { client_reference_id: u.userId, customer: 'cus_1' } } };
  assert.equal((await c.hook(event, sign(JSON.stringify(event), 'wrong-secret'))).statusCode, 400);
  assert.equal((await c.hook(event, 't=1,v1=bad')).statusCode, 400);
  const garbage = '{not json';
  const res = await c.app.inject({ method: 'POST', url: '/api/webhooks/stripe', headers: { 'content-type': 'application/json', 'stripe-signature': sign(garbage) }, payload: garbage });
  assert.equal(res.statusCode, 400);
  assert.equal(await c.store.count('subscriptions'), 0);
  assert.equal(await planOf(c.store, u.userId), 'free');
  await c.app.close();
});

test('only the webhook writes the subscription: checkout completed makes the plan paid', async () => {
  const c = setup();
  const u = await signUp(c.app, { yearsOld: 40 });
  await c.app.inject({ method: 'POST', url: '/api/billing/checkout', headers: u.headers });
  assert.equal(await c.store.count('subscriptions'), 0, 'starting checkout writes nothing');
  const res = await c.hook({ type: 'checkout.session.completed', data: { object: { client_reference_id: u.userId, customer: 'cus_1', subscription: 'sub_1' } } });
  assert.equal(res.statusCode, 200);
  assert.equal(await planOf(c.store, u.userId), 'paid');
  const sub = await c.store.get<SubscriptionRow>('subscriptions', { user_id: u.userId });
  assert.deepEqual([sub?.stripe_customer_id, sub?.status], ['cus_1', 'active']);
  // Already subscribed: a second checkout is refused.
  assert.equal((await c.app.inject({ method: 'POST', url: '/api/billing/checkout', headers: u.headers })).statusCode, 409);
  await c.app.close();
});

test('subscription updates and cancellation move the plan, and replays are harmless', async () => {
  const c = setup();
  const u = await signUp(c.app, { yearsOld: 40 });
  await c.hook({ type: 'checkout.session.completed', data: { object: { client_reference_id: u.userId, customer: 'cus_1' } } });
  const update = (status: string) => ({ type: 'customer.subscription.updated', data: { object: { customer: 'cus_1', status, current_period_end: 1_900_000_000, metadata: { userId: u.userId } } } });
  await c.hook(update('active'));
  await c.hook(update('active'));
  assert.equal(await c.store.count('subscriptions'), 1);
  assert.equal(await planOf(c.store, u.userId), 'paid');
  assert.match((await c.store.get<SubscriptionRow>('subscriptions', { user_id: u.userId }))?.current_period_end ?? '', /^2030-/);
  await c.hook(update('past_due'));
  assert.equal(await planOf(c.store, u.userId), 'free');
  await c.hook(update('trialing'));
  assert.equal(await planOf(c.store, u.userId), 'paid');
  await c.hook({ type: 'customer.subscription.deleted', data: { object: { customer: 'cus_1' } } });
  assert.equal(await planOf(c.store, u.userId), 'free');
  assert.equal((await c.store.get<SubscriptionRow>('subscriptions', { user_id: u.userId }))?.status, 'canceled');
  const failed = await c.hook({ type: 'invoice.payment_failed', data: { object: { customer: 'unknown' } } });
  assert.equal((failed.json() as { handled: boolean }).handled, false);
  assert.equal((await c.hook({ type: 'something.else', data: { object: {} } })).statusCode, 200);
  await c.app.close();
});

test('the portal needs an existing subscription and opens for its customer', async () => {
  const c = setup();
  const u = await signUp(c.app, { yearsOld: 40 });
  assert.equal((await c.app.inject({ method: 'POST', url: '/api/billing/portal', headers: u.headers })).statusCode, 404);
  await c.hook({ type: 'checkout.session.completed', data: { object: { client_reference_id: u.userId, customer: 'cus_77' } } });
  const res = await c.app.inject({ method: 'POST', url: '/api/billing/portal', headers: u.headers });
  assert.match((res.json() as { url: string }).url, /portal\/cus_77$/);
  await c.app.close();
});

test('login re-sync heals a missed webhook, and downgrades when Stripe says the subscription ended', async () => {
  const c = setup();
  const u = await signUp(c.app, { yearsOld: 40 });
  assert.deepEqual((await c.app.inject({ method: 'POST', url: '/api/billing/sync', headers: u.headers })).json(), { plan: 'free', status: null });

  // The webhook never arrived, but Stripe has an active subscription tagged with this user.
  c.billingProvider.subs.set(u.userId, [{ id: 'sub_1', customer: 'cus_9', status: 'active', currentPeriodEnd: 1_900_000_000 }]);
  assert.deepEqual((await c.app.inject({ method: 'POST', url: '/api/billing/sync', headers: u.headers })).json(), { plan: 'paid', status: 'active' });
  assert.equal(await planOf(c.store, u.userId), 'paid');
  assert.equal((await c.store.get<SubscriptionRow>('subscriptions', { user_id: u.userId }))?.stripe_customer_id, 'cus_9');

  c.billingProvider.subs.set(u.userId, [{ id: 'sub_1', customer: 'cus_9', status: 'canceled', currentPeriodEnd: 1_800_000_000 }]);
  assert.deepEqual((await c.app.inject({ method: 'POST', url: '/api/billing/sync', headers: u.headers })).json(), { plan: 'free', status: 'canceled' });
  assert.equal(await planOf(c.store, u.userId), 'free');
  assert.equal((await c.app.inject({ method: 'POST', url: '/api/billing/sync' })).statusCode, 401);
  await c.app.close();
});

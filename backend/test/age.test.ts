import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { readSigned, signValue } from '../src/lib/cookies';
import { evaluateAge, minAccountAge } from '../src/services/age';
import { generateNickname } from '../src/services/nickname';

const now = new Date('2026-06-15T00:00:00Z');

test('the youngest-possible-age rule decides the band', () => {
  assert.equal(evaluateAge(2014, null, now).band, 'under13'); // youngest 11
  assert.equal(evaluateAge(2013, null, now).band, 'under13'); // youngest 12
  assert.equal(evaluateAge(2012, null, now).band, '13to17'); // youngest 13
  assert.equal(evaluateAge(2008, null, now).band, '13to17'); // youngest 17 is still a teen
  assert.equal(evaluateAge(2007, null, now).band, 'adult'); // youngest 18
});

test('13 and over may hold an account, 16 and over in the EEA and UK', () => {
  assert.equal(evaluateAge(2010, 'US', now).canHaveAccount, true); // youngest 15
  assert.equal(evaluateAge(2010, 'DE', now).canHaveAccount, false); // needs 16
  assert.equal(evaluateAge(2009, 'de', now).canHaveAccount, true); // youngest 16
  assert.equal(evaluateAge(2015, 'US', now).canHaveAccount, false);
  assert.equal(minAccountAge('GB'), 16);
  assert.equal(minAccountAge('US'), 13);
});

test('signed values detect tampering', () => {
  const s = signValue('2010|DE', 'secret-secret-secret');
  assert.equal(readSigned(s, 'secret-secret-secret'), '2010|DE');
  assert.equal(readSigned(s.replace('2010', '1980'), 'secret-secret-secret'), null);
  assert.equal(readSigned(s, 'different-secret-here'), null);
  assert.equal(readSigned(undefined, 'x'), null);
});

test('nicknames are stable per seed and look friendly', () => {
  assert.equal(generateNickname('user-1'), generateNickname('user-1'));
  assert.notEqual(generateNickname('user-1'), generateNickname('user-2'));
  assert.match(generateNickname('user-1'), /^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
});

async function session(app: ReturnType<typeof buildApp>) {
  const t = (await app.inject({ method: 'POST', url: '/api/auth/dev-token', payload: { email: 'p@x.io' } })).json() as { token: string };
  return { authorization: `Bearer ${t.token}` };
}

test('the first age answer is remembered and a retry with another year is ignored', async () => {
  const app = buildApp();
  const first = await app.inject({ method: 'POST', url: '/api/age', payload: { birthYear: new Date().getUTCFullYear() - 9, country: 'US' } });
  const cookie = String(first.headers['set-cookie']).split(';')[0] as string;
  assert.equal((first.json() as { band: string }).band, 'under13');
  assert.match(String(first.headers['set-cookie']), /HttpOnly/);

  const retry = await app.inject({ method: 'POST', url: '/api/age', headers: { cookie }, payload: { birthYear: 1980, country: 'US' } });
  assert.equal((retry.json() as { band: string }).band, 'under13');
  assert.equal(retry.headers['set-cookie'], undefined);
  await app.close();
});

test('an under-13 cannot create a profile, even with a valid login', async () => {
  const app = buildApp();
  const first = await app.inject({ method: 'POST', url: '/api/age', payload: { birthYear: new Date().getUTCFullYear() - 9 } });
  const cookie = String(first.headers['set-cookie']).split(';')[0] as string;
  const res = await app.inject({ method: 'POST', url: '/api/me/profile', headers: { cookie, ...(await session(app)) }, payload: { displayName: 'Kiddo' } });
  assert.equal(res.statusCode, 403);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'age_blocked');
  await app.close();
});

test('a teen gets a generated nickname, an adult keeps the chosen name, and only one profile is allowed', async () => {
  const year = new Date().getUTCFullYear();
  const app = buildApp();
  const teen = await app.inject({ method: 'POST', url: '/api/age', payload: { birthYear: year - 16, country: 'US' } });
  const teenCookie = String(teen.headers['set-cookie']).split(';')[0] as string;
  const auth = await session(app);
  const made = await app.inject({ method: 'POST', url: '/api/me/profile', headers: { cookie: teenCookie, ...auth }, payload: { displayName: 'ChosenName' } });
  assert.equal(made.statusCode, 201);
  assert.notEqual((made.json() as { profile: { display_name: string } }).profile.display_name, 'ChosenName');
  const again = await app.inject({ method: 'POST', url: '/api/me/profile', headers: { cookie: teenCookie, ...auth }, payload: {} });
  assert.equal(again.statusCode, 409);

  const adult = await app.inject({ method: 'POST', url: '/api/age', payload: { birthYear: year - 40, country: 'US' } });
  const adultCookie = String(adult.headers['set-cookie']).split(';')[0] as string;
  const res = await app.inject({ method: 'POST', url: '/api/me/profile', headers: { cookie: adultCookie, ...(await session(app)) }, payload: { displayName: 'Grown Up' } });
  assert.equal((res.json() as { profile: { display_name: string } }).profile.display_name, 'Grown Up');
  await app.close();
});

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { api, ApiError, errorMessage } from '../src/lib/api';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const respond = (status: number, body: unknown) => {
  globalThis.fetch = (async () => new Response(body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof fetch;
};

test('a successful call returns the parsed body, and 204 returns nothing', async () => {
  respond(200, { ok: 1 });
  assert.deepEqual(await api('/x'), { ok: 1 });
  respond(204, undefined);
  assert.equal(await api('/x', { method: 'DELETE' }), undefined);
});

test('the error envelope becomes an ApiError with its code, message and details', async () => {
  respond(429, { error: { code: 'limit_reached', message: 'No builds left today', details: { limit: 3 } } });
  await assert.rejects(api('/games/generate', { body: {} }), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.deepEqual([e.status, e.code, e.message, e.details], [429, 'limit_reached', 'No builds left today', { limit: 3 }]);
    return true;
  });
});

test('a call that never reaches the server says so in plain words', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  await assert.rejects(api('/x'), (e: unknown) => e instanceof ApiError && e.code === 'network' && /could not reach the server/.test(e.message));
});

test('a gateway error page (HTML) is reported as the service being unavailable', async () => {
  respond(502, '<html>Bad gateway</html>');
  await assert.rejects(api('/x'), (e: unknown) => e instanceof ApiError && e.code === 'unavailable' && /having a moment/.test(e.message));
  respond(404, '<html>nope</html>');
  await assert.rejects(api('/x'), (e: unknown) => e instanceof ApiError && e.code === 'error');
});

test('an aborted request is not mistaken for a network failure', async () => {
  globalThis.fetch = (async () => {
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  }) as typeof fetch;
  await assert.rejects(api('/x'), (e: unknown) => !(e instanceof ApiError));
});

test('errorMessage never leaks raw errors', () => {
  assert.equal(errorMessage(new ApiError(400, 'bad', 'Nice words')), 'Nice words');
  assert.match(errorMessage(new Error('secret internals')), /Something went wrong/);
  assert.match(errorMessage('x'), /Something went wrong/);
});

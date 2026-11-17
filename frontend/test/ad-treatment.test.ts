import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adsEnabled, adTreatment } from '../src/lib/ad-treatment';

test('under 13 and unknown ages are tagged child-directed', () => {
  for (const band of ['under13', null, undefined] as const) {
    assert.deepEqual(adTreatment(band), { childDirected: true, underAgeOfConsent: false, nonPersonalized: true });
  }
});

test('teens get the under-age-of-consent tag, adults get neither, and nobody gets personalised ads', () => {
  assert.deepEqual(adTreatment('13to17'), { childDirected: false, underAgeOfConsent: true, nonPersonalized: true });
  assert.deepEqual(adTreatment('adult'), { childDirected: false, underAgeOfConsent: false, nonPersonalized: true });
});

test('ads need production, the switch and a valid publisher id', () => {
  const ok = { NODE_ENV: 'production', NEXT_PUBLIC_ADS_ENABLED: 'true', NEXT_PUBLIC_ADSENSE_CLIENT: 'ca-pub-1234567890' };
  assert.equal(adsEnabled(ok), true);
  assert.equal(adsEnabled({ ...ok, NODE_ENV: 'development' }), false);
  assert.equal(adsEnabled({ ...ok, NEXT_PUBLIC_ADS_ENABLED: 'false' }), false);
  assert.equal(adsEnabled({ ...ok, NEXT_PUBLIC_ADSENSE_CLIENT: 'nope' }), false);
  assert.equal(adsEnabled({}), false);
});

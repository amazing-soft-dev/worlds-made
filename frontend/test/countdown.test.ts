import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCountdown } from '../src/components/daily/Countdown';

test('the countdown shows hours, minutes and seconds with leading zeros', () => {
  assert.equal(formatCountdown(0), '00:00:00');
  assert.equal(formatCountdown(59), '00:00:59');
  assert.equal(formatCountdown(61), '00:01:01');
  assert.equal(formatCountdown(3661), '01:01:01');
  assert.equal(formatCountdown(86399), '23:59:59');
});

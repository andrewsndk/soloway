import test from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionBookingAmount } from './subscription-payment.ts';

test('editing payment method preserves the first package charge even with a stale zero draft', () => {
  assert.equal(subscriptionBookingAmount(7200, 0, false), 7200);
});

test('editing a covered visit never charges the package price again', () => {
  assert.equal(subscriptionBookingAmount(0, 7200, false), 0);
  assert.throws(() => subscriptionBookingAmount(0, 7200, true));
});

test('an agreed discount survives editing and can be adjusted explicitly', () => {
  assert.equal(subscriptionBookingAmount(3600, 7200, false), 3600);
  assert.equal(subscriptionBookingAmount(7200, 6480, true), 6480);
});

test('manual editing cannot erase an existing package payment', () => {
  assert.throws(() => subscriptionBookingAmount(7200, 0, true));
  assert.throws(() => subscriptionBookingAmount(7200, -1, true));
  assert.throws(() => subscriptionBookingAmount(7200, NaN, true));
});

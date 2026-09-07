import test from 'node:test';
import assert from 'node:assert/strict';
import { calcExtraDue } from './pricing.ts';

const settings = { tariffs: { hour_1: 500, hour_3: 850, half_day: 1090, full_day: 1390, adaptation: 300, extra_per_hour: 500, extra_per_hour_above3: 300 } };
const start = '2026-09-03T06:30:00Z';
const due = (amount, format, minutes, booking = {}) => calcExtraDue(amount, format, start, new Date(Date.parse(start) + minutes * 60000).toISOString(), settings, booking);

test('package visits are covered independently of the cash amount on the visit', () => {
  assert.equal(due(0, 'hour_3', 165, { subscription_id: 'package' }), 0);
  assert.equal(due(0, 'hour_3', 210, { subscription_id: 'package' }), 0);
  assert.equal(due(0, 'full_day', 560, { subscription_id: 'unlimited' }), 0);
  assert.equal(due(0, 'half_day', 360, { subscription_id: 'package' }), 0);
});
test('an agreed total including a family discount is not recalculated', () => {
  assert.equal(due(1251, 'full_day', 580, { amount_override: true }), 0);
  assert.equal(due(951, 'half_day', 360, { amount_override: true }), 0);
  assert.equal(due(755, 'other', 120, { amount_override: true }), 0);
});
test('leaving before the end of a three-hour booking cannot create an extra charge', () => {
  assert.equal(due(850, 'hour_3', 120), 0);
  assert.equal(due(850, 'hour_3', 180), 0);
});
test('ordinary overtime and a genuine price difference still appear', () => {
  assert.equal(due(850, 'hour_3', 210), 300);
  assert.equal(due(500, 'hour_1', 90), 500);
  assert.equal(due(1000, 'full_day', 480), 390);
});
test('adaptation and a six-hour half day retain their fixed tariff', () => {
  assert.equal(due(300, 'adaptation', 60), 0);
  assert.equal(due(1090, 'half_day', 360), 0);
});
test('cancelled visits and visits without checkout have no extra charge', () => {
  assert.equal(due(0, 'full_day', 480, { status: 'Скасовано' }), 0);
  assert.equal(calcExtraDue(0, 'hour_3', start, null, settings, {}), 0);
});

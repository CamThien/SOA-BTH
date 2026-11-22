import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, cents, objectBody, parseCosts, positiveId } from '../dist/reports/calculation.js';

const order = () => ({ id: 10, status: 'completed', total_amount: '25.55', items: [
  { product_id: 1, quantity: 1, unit_price: '12.34', total_price: '12.34' },
  { product_id: 1, quantity: 1, unit_price: '12.34', total_price: '12.34' },
  { product_id: 2, quantity: 3, unit_price: '0.29', total_price: '0.87' },
] });
const costs = () => parseCosts([{ product_id: 1, unit_cost: 10 }, { product_id: 2, unit_cost: 0.1 }]);
function status(fn, expected) { assert.throws(fn, e => e.getStatus?.() === expected); }

test('calculates totals using historical selling prices and groups repeated products', () => {
  const result = calculate(order(), costs());
  assert.deepEqual(result.totals, { total_revenue: 25.55, total_cost: 20.3, total_profit: 5.25 });
  assert.deepEqual(result.lines[0], { product_id: 1, total_sold: 2, revenue: 24.68, cost: 20, profit: 4.68 });
  assert.equal(result.lines[1].profit, 0.57);
});
test('allows a real zero cost only when explicitly supplied and allows losses', () => {
  const result = calculate(order(), parseCosts([{ product_id: 1, unit_cost: 20 }, { product_id: 2, unit_cost: 0 }]));
  assert.equal(result.totals.total_profit, -14.45);
});
test('excludes pending and cancelled orders', () => {
  for (const value of ['pending', 'cancelled']) status(() => calculate({ ...order(), status: value }, costs()), 400);
});
test('requires complete actual costs; rejects extra and repeated product costs', () => {
  for (const value of [undefined, [], [{ product_id: 1 }], [{ product_id: 1, unit_cost: null }], [{ product_id: 1, unit_cost: -1 }], [{ product_id: 1, unit_cost: 0.001 }], [{ product_id: 1, unit_cost: '10' }]]) status(() => parseCosts(value), 400);
  status(() => parseCosts([{ product_id: 1, unit_cost: 10 }, { product_id: 1, unit_cost: 10 }]), 400);
  status(() => calculate(order(), parseCosts([{ product_id: 1, unit_cost: 10 }])), 400);
  status(() => calculate(order(), new Map([...costs(), [3, 10]])), 400);
});
test('rejects malformed upstream amounts, quantities and inconsistent totals', () => {
  status(() => calculate({ ...order(), total_amount: 10 }, costs()), 502);
  for (const patch of [{ quantity: 0 }, { quantity: 1.5 }, { unit_price: 'NaN' }, { total_price: 12.35 }]) {
    const changed = order(); Object.assign(changed.items[0], patch);
    status(() => calculate(changed, costs()), 502);
  }
  status(() => calculate({ ...order(), items: [] }, costs()), 400);
});
test('enforces DECIMAL(10,2) and INT boundaries without rounding user input', () => {
  assert.equal(cents(99999999.99, 'cost'), 9999999999);
  assert.equal(cents(0.29, 'cost'), 29);
  for (const value of [NaN, Infinity, -1, 100000000, 0.001, null]) status(() => cents(value, 'cost'), 400);
  for (const value of [0, -1, 1.5, null, '1', 2147483648]) status(() => positiveId(value), 400);
  status(() => calculate(order(), parseCosts([{ product_id: 1, unit_cost: 99999999.99 }, { product_id: 2, unit_cost: 0 }])), 400);
});
test('rejects unknown fields so clients cannot inject calculated totals', () => {
  status(() => objectBody({ order_id: 1, total_profit: 999 }, ['order_id', 'costs']), 400);
});

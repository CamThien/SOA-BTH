// Isolated API tests: HTTP source fixtures and in-memory repositories only.
// These tests never connect to product_db, order_db or reporting_db.
import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthGuard } from '../dist/auth/auth.guard.js';
import { OrderReport } from '../dist/reports/entities/order-report.entity.js';
import { ProductReport } from '../dist/reports/entities/product-report.entity.js';
import { ReportsController } from '../dist/reports/reports.controller.js';
import { ReportsService } from '../dist/reports/reports.service.js';
import { SourceService } from '../dist/reports/source.service.js';

function memory() {
  const tables = new Map([[OrderReport, []], [ProductReport, []]]);
  const ids = new Map([[OrderReport, 0], [ProductReport, 0]]);
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => row[key] === value);
  const repositories = new Map();
  const manager = {
    async find(entity, options = {}) { return structuredClone(tables.get(entity).filter(r => matches(r, options.where))); },
    async findOne(entity, options) { return (await this.find(entity, options))[0] ?? null; },
    create(_entity, data) { return { ...data }; },
    async save(entity, data) {
      const row = { ...data, id: (ids.get(entity) || 0) + 1 }; ids.set(entity, row.id);
      tables.get(entity).push(row); return structuredClone(row);
    },
  };
  let queue = Promise.resolve();
  // Keep constructors out of structuredClone.
  manager.transaction = fn => {
    const work = queue.then(async () => {
      const snapshot = [structuredClone(tables.get(OrderReport)), structuredClone(tables.get(ProductReport))];
      try { return await fn(manager); }
      catch (error) { tables.set(OrderReport, snapshot[0]); tables.set(ProductReport, snapshot[1]); throw error; }
    });
    queue = work.catch(() => {}); return work;
  };
  for (const entity of [OrderReport, ProductReport]) repositories.set(entity, {
    manager,
    find: options => manager.find(entity, options),
    findOne: options => manager.findOne(entity, options),
    create: data => manager.create(entity, data),
    save: data => manager.save(entity, data),
    async delete(id) {
      const before = tables.get(entity).length;
      tables.set(entity, tables.get(entity).filter(row => row.id !== id));
      if (entity === OrderReport) tables.set(ProductReport, tables.get(ProductReport).filter(row => row.order_report_id !== id));
      return { affected: before - tables.get(entity).length };
    },
  });
  return { repositories, tables };
}

test('all reporting routes, authentication, costs, stock and deletion through HTTP', async t => {
  const state = { status: 'completed', quantity: 7, authDown: false, orderDown: false, productDown: false, deletedProduct: false };
  const seen = [];
  const source = createServer((req, res) => {
    seen.push({ path: req.url, token: req.headers.authorization });
    res.setHeader('Content-Type', 'application/json');
    const send = (code, data) => { res.statusCode = code; res.end(JSON.stringify(data)); };
    if (req.url === '/auth') return state.authDown ? send(503, {}) : send(req.headers.authorization === 'Bearer valid' ? 200 : 403, {});
    if (req.headers.authorization !== 'Bearer valid') return send(401, {});
    if (req.url === '/orders/10') return state.orderDown ? send(503, {}) : send(200, {
      id: 10, status: state.status, total_amount: 25.55, items: [
        { product_id: 1, quantity: 2, unit_price: 12.34, total_price: 24.68 },
        { product_id: 2, quantity: 3, unit_price: 0.29, total_price: 0.87 },
      ],
    });
    const products = [{ id: 1, name: 'Test product', quantity: state.quantity, price: 999 }, { id: 2, name: 'Other', quantity: 20, price: 999 }];
    if (req.url.startsWith('/products') && state.productDown) return send(503, {});
    if (req.url === '/products') return send(200, state.deletedProduct ? products.slice(1) : products);
    if (req.url === '/products/1' && !state.deletedProduct) return send(200, products[0]);
    if (req.url === '/products/2') return send(200, products[1]);
    return send(404, {});
  });
  await new Promise(resolve => source.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => source.close(resolve)));
  const base = `http://127.0.0.1:${source.address().port}`;
  const previous = Object.fromEntries(['AUTH_SERVICE_URL', 'PRODUCT_SERVICE_URL', 'ORDER_SERVICE_URL'].map(key => [key, process.env[key]]));
  for (const key of Object.keys(previous)) process.env[key] = base;
  t.after(() => { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; });
  const store = memory();
  class TestModule {}
  Module({
    controllers: [ReportsController],
    providers: [ReportsService, SourceService, AuthGuard, ...[OrderReport, ProductReport].map(entity => ({ provide: getRepositoryToken(entity), useValue: store.repositories.get(entity) }))],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const url = await app.getUrl();
  const costs = [{ product_id: 1, unit_cost: 10 }, { product_id: 2, unit_cost: 0.1 }];
  let checks = 0;
  async function api(method, path, body, expected = 200, token = 'valid') {
    const response = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json', ...(token === null ? {} : { Authorization: `Bearer ${token}` }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`); checks++; return data;
  }
  const routes = [['GET', '/reports/products'], ['GET', '/reports/products/1'], ['GET', '/reports/orders'], ['GET', '/reports/orders/1'], ['POST', '/reports/products'], ['POST', '/reports/orders'], ['DELETE', '/reports/products/1'], ['DELETE', '/reports/orders/1']];
  for (const [method, path] of routes) {
    await api(method, path, method === 'POST' ? {} : undefined, 401, null);
    await api(method, path, method === 'POST' ? {} : undefined, 401, 'invalid');
  }
  state.authDown = true; await api('GET', '/reports/orders', undefined, 503); state.authDown = false;
  assert.deepEqual(await api('GET', '/reports/products'), []);
  await api('POST', '/reports/orders', { order_id: 10 }, 400);
  await api('POST', '/reports/orders', { order_id: 10, costs, total_revenue: 1 }, 400);
  for (const status of ['pending', 'cancelled']) {
    state.status = status; await api('POST', '/reports/orders', { order_id: 10, costs }, 400);
  }
  state.status = 'completed';
  state.orderDown = true; await api('POST', '/reports/orders', { order_id: 10, costs }, 503); state.orderDown = false;
  await api('POST', '/reports/orders', { order_id: 999, costs }, 404);
  const report = await api('POST', '/reports/orders', { order_id: 10, costs }, 201);
  assert.deepEqual({ ...report, id: undefined }, { id: undefined, order_id: 10, total_revenue: 25.55, total_cost: 20.3, total_profit: 5.25 });
  assert.equal(store.tables.get(ProductReport).length, 0);
  assert.equal((await api('GET', `/reports/orders/${report.id}`)).order_id, 10);
  assert.equal((await api('GET', '/reports/orders?order_id=10')).length, 1);
  assert.deepEqual(await api('GET', '/reports/orders?order_id=11'), []);
  const body = { order_report_id: report.id, product_id: 1, costs };
  await api('POST', '/reports/products', { ...body, costs: [{ product_id: 1, unit_cost: 9 }, costs[1]] }, 409);
  await api('POST', '/reports/products', { ...body, product_id: 3 }, 400);
  await api('POST', '/reports/products', { ...body, order_report_id: 999 }, 404);
  state.productDown = true; await api('POST', '/reports/products', body, 503); state.productDown = false;
  const line = await api('POST', '/reports/products', body, 201);
  assert.equal(line.total_sold, 2); assert.equal(line.revenue, 24.68); assert.equal(line.cost, 20); assert.equal(line.profit, 4.68); assert.equal(line.stock_quantity, 7);
  await api('POST', '/reports/products', body, 409);
  const two = { ...body, product_id: 2 };
  const parallel = await Promise.all([fetch(url + '/reports/products', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' }, body: JSON.stringify(two) }), fetch(url + '/reports/products', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' }, body: JSON.stringify(two) })]);
  assert.deepEqual(parallel.map(r => r.status).sort(), [201, 409]);
  await Promise.all(parallel.map(r => r.json()));
  assert.equal((await api('GET', '/reports/products')).length, 2);
  assert.equal((await api('GET', '/reports/products?product_id=1')).length, 1);
  state.quantity = 5;
  const viewed = await api('GET', `/reports/products/${line.id}`);
  assert.equal(viewed.stock_quantity, 5); assert.equal(viewed.revenue, 24.68);
  state.deletedProduct = true;
  assert.equal((await api('GET', `/reports/products/${line.id}`)).stock_quantity, null);
  state.deletedProduct = false;
  for (const path of ['/reports/products/0', '/reports/products/abc', '/reports/orders/-1', '/reports/orders?order_id=0']) await api('GET', path, undefined, 400);
  await api('DELETE', `/reports/products/${line.id}`);
  await api('GET', `/reports/products/${line.id}`, undefined, 404);
  await api('DELETE', `/reports/products/${line.id}`, undefined, 404);
  assert.equal((await api('GET', `/reports/orders/${report.id}`)).total_revenue, 25.55);
  await api('DELETE', `/reports/orders/${report.id}`);
  await api('GET', `/reports/orders/${report.id}`, undefined, 404);
  await api('DELETE', `/reports/orders/${report.id}`, undefined, 404);
  assert.deepEqual(await api('GET', '/reports/products'), []);
  assert.equal(store.tables.get(OrderReport).length, 0);
  assert.ok(seen.filter(r => r.path !== '/auth').every(r => r.token === 'Bearer valid'));
  t.diagnostic(`${checks} HTTP checks; source data was only read; no SQL connection or persistent fixture data`);
});

import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import { OrderReport } from '../dist/reports/entities/order-report.entity.js';
import { ProductReport } from '../dist/reports/entities/product-report.entity.js';

test('SQL Server entity mapping matches the appendix and keeps the FK inside the reporting database', async () => {
  const source = new DataSource({ type: 'mssql', host: 'unused', database: 'reporting_db', entities: [OrderReport, ProductReport], synchronize: false });
  // Metadata construction does not establish a SQL connection.
  await source.buildMetadatas();
  const orders = source.getMetadata(OrderReport);
  const products = source.getMetadata(ProductReport);
  assert.equal(orders.tableName, 'orders_reports');
  assert.equal(products.tableName, 'product_reports');
  assert.deepEqual(orders.columns.map(c => c.databaseName).sort(), ['id', 'order_id', 'total_revenue', 'total_cost', 'total_profit'].sort());
  assert.deepEqual(products.columns.map(c => c.databaseName).sort(), ['id', 'order_report_id', 'product_id', 'total_sold', 'revenue', 'cost', 'profit'].sort());
  for (const column of [...orders.columns, ...products.columns].filter(c => c.type === 'decimal')) {
    assert.equal(column.precision, 10); assert.equal(column.scale, 2);
  }
  assert.equal(products.foreignKeys.length, 1);
  assert.equal(products.foreignKeys[0].referencedEntityMetadata.tableName, 'orders_reports');
  assert.equal(products.foreignKeys[0].onDelete, 'CASCADE');
  assert.equal(orders.foreignKeys.length, 0);
});

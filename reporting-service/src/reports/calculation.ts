import { BadGatewayException, BadRequestException } from '@nestjs/common';

export const MAX_CENTS = 9_999_999_999;
export type CostInput = { product_id: number; unit_cost: number };
export type CreateOrderReportInput = { order_id: number; costs: CostInput[] };
export type CreateProductReportInput = { order_report_id: number; product_id: number; costs: CostInput[] };
export type SourceItem = { product_id: number; quantity: number; unit_price: number | string; total_price: number | string };
export type SourceOrder = { id: number; status: string; total_amount: number | string; items: SourceItem[] };
export type SourceProduct = { id: number; name: string; quantity: number };

export function positiveId(value: unknown, field = 'id'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new BadRequestException(`${field} must be a positive INT`);
  }
  return value;
}

export function objectBody(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('JSON object is required');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !fields.includes(key))) throw new BadRequestException(`Allowed fields: ${fields.join(', ')}`);
  return body;
}

// Work in integer cents, avoiding accumulation of binary floating point errors.
export function cents(value: unknown, field: string, source = false): number {
  const fail = () => { throw source ? new BadGatewayException(`Invalid ${field} in source data`) : new BadRequestException(`${field} must be a nonnegative DECIMAL(10,2)`); };
  if (typeof value !== 'number' && !(source && typeof value === 'string')) return fail();
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return fail();
  const [whole, decimal = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > MAX_CENTS) return fail();
  return result;
}

export function bounded(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_CENTS) throw new BadRequestException(`${field} exceeds DECIMAL(10,2)`);
  return value;
}

export function parseCosts(value: unknown): Map<number, number> {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestException('costs must contain the actual unit cost of every product in the order');
  const result = new Map<number, number>();
  for (const entry of value) {
    const row = objectBody(entry, ['product_id', 'unit_cost']);
    const id = positiveId(row.product_id, 'product_id');
    if (result.has(id)) throw new BadRequestException('Duplicate product_id in costs');
    result.set(id, cents(row.unit_cost, 'unit_cost'));
  }
  return result;
}

export function calculate(order: SourceOrder, costs: Map<number, number>) {
  if (!order || !Number.isInteger(order.id) || order.id < 1 || !Array.isArray(order.items)) throw new BadGatewayException('Invalid order response');
  if (order.status !== 'completed') throw new BadRequestException('Only completed orders count as sold');
  if (order.items.length === 0) throw new BadRequestException('The order has no products');
  const groups = new Map<number, { product_id: number; total_sold: number; revenueCents: number; costCents: number }>();
  for (const item of order.items) {
    if (!item || !Number.isInteger(item.product_id) || item.product_id < 1 || item.product_id > 2_147_483_647 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2_147_483_647) throw new BadGatewayException('Invalid order item');
    const unitCost = costs.get(item.product_id);
    if (unitCost === undefined) throw new BadRequestException(`Missing unit_cost for product ${item.product_id}`);
    const lineRevenue = cents(item.total_price, 'total_price', true);
    const unitPrice = cents(item.unit_price, 'unit_price', true);
    if (unitPrice * item.quantity !== lineRevenue) throw new BadGatewayException('Order item total_price does not match quantity * unit_price');
    const row = groups.get(item.product_id) || { product_id: item.product_id, total_sold: 0, revenueCents: 0, costCents: 0 };
    row.total_sold += item.quantity;
    if (row.total_sold > 2_147_483_647) throw new BadRequestException('total_sold exceeds INT');
    row.revenueCents = bounded(row.revenueCents + lineRevenue, 'revenue');
    row.costCents = bounded(row.costCents + bounded(unitCost * item.quantity, 'cost'), 'cost');
    groups.set(item.product_id, row);
  }
  if ([...costs.keys()].some(id => !groups.has(id))) throw new BadRequestException('costs contains a product outside the order');
  const lines = [...groups.values()].map(row => ({
    product_id: row.product_id,
    total_sold: row.total_sold,
    revenue: row.revenueCents / 100,
    cost: row.costCents / 100,
    profit: bounded(row.revenueCents - row.costCents, 'profit') / 100,
  }));
  const revenue = bounded([...groups.values()].reduce((sum, row) => sum + row.revenueCents, 0), 'total_revenue');
  const cost = bounded([...groups.values()].reduce((sum, row) => sum + row.costCents, 0), 'total_cost');
  if (revenue !== cents(order.total_amount, 'total_amount', true)) throw new BadGatewayException('Order total does not match its items');
  return { lines, totals: { total_revenue: revenue / 100, total_cost: cost / 100, total_profit: bounded(revenue - cost, 'total_profit') / 100 } };
}

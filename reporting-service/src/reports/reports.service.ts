import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderReport } from './entities/order-report.entity.js';
import { ProductReport } from './entities/product-report.entity.js';
import { calculate, cents, objectBody, parseCosts, positiveId, SourceProduct } from './calculation.js';
import { SourceService } from './source.service.js';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(OrderReport) private readonly orderReports: Repository<OrderReport>,
    @InjectRepository(ProductReport) private readonly productReports: Repository<ProductReport>,
    private readonly source: SourceService,
  ) {}

  orders(orderId?: number) {
    return this.orderReports.find({ where: orderId === undefined ? {} : { order_id: orderId }, order: { id: 'ASC' } });
  }
  async order(id: number) {
    const report = await this.orderReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Order report not found');
    return report;
  }
  private withStock(report: ProductReport, product?: SourceProduct) {
    return { ...report, product_name: product?.name ?? null, stock_quantity: product?.quantity ?? null };
  }
  async products(token: string, productId?: number) {
    const reports = await this.productReports.find({ where: productId === undefined ? {} : { product_id: productId }, order: { id: 'ASC' } });
    if (reports.length === 0) return [];
    const products = new Map((await this.source.products(token)).map(p => [p.id, p]));
    return reports.map(r => this.withStock(r, products.get(r.product_id)));
  }
  async product(id: number, token: string) {
    const report = await this.productReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Product report not found');
    // Saved sales figures remain readable even if the product has since been deleted.
    const products = await this.source.products(token);
    return this.withStock(report, products.find(p => p.id === report.product_id));
  }
  async createOrder(input: unknown, token: string) {
    const body = objectBody(input, ['order_id', 'costs']);
    const orderId = positiveId(body.order_id, 'order_id');
    const costs = parseCosts(body.costs);
    const order = await this.source.order(orderId, token);
    if (order?.id !== orderId) throw new BadGatewayException('Order response has an incorrect id');
    const { totals } = calculate(order, costs);
    return this.orderReports.save(this.orderReports.create({ order_id: orderId, ...totals }));
  }
  async createProduct(input: unknown, token: string) {
    const body = objectBody(input, ['order_report_id', 'product_id', 'costs']);
    const orderReportId = positiveId(body.order_report_id, 'order_report_id');
    const productId = positiveId(body.product_id, 'product_id');
    const costs = parseCosts(body.costs);
    const parent = await this.order(orderReportId);
    const order = await this.source.order(parent.order_id, token);
    if (order?.id !== parent.order_id) throw new BadGatewayException('Order response has an incorrect id');
    const calculated = calculate(order, costs);
    for (const key of ['total_revenue', 'total_cost', 'total_profit'] as const) {
      if (Number(parent[key]) !== calculated.totals[key]) throw new ConflictException('Source data or costs differ from the saved order report. Use the same costs or create a new order report');
    }
    const line = calculated.lines.find(row => row.product_id === productId);
    if (!line) throw new BadRequestException('Product is not in the order');
    const product = await this.source.product(productId, token);
    const report = await this.orderReports.manager.transaction(async manager => {
      // Serialize creation/deletion for this parent, preventing duplicate product reports.
      const current = await manager.findOne(OrderReport, { where: { id: orderReportId }, lock: { mode: 'pessimistic_write' } });
      if (!current) throw new NotFoundException('Order report not found');
      const existing = await manager.findOne(ProductReport, { where: { order_report_id: orderReportId, product_id: productId } });
      if (existing) throw new ConflictException('This product already has a report in the order report');
      // Existing detail reports must also agree with the supplied cost allocation.
      const siblings = await manager.find(ProductReport, { where: { order_report_id: orderReportId } });
      for (const sibling of siblings) {
        const expected = calculated.lines.find(row => row.product_id === sibling.product_id);
        if (!expected || cents(sibling.cost, 'cost', true) !== cents(expected.cost, 'cost', true)) throw new ConflictException('Costs differ from existing product reports');
      }
      return manager.save(ProductReport, manager.create(ProductReport, { order_report_id: orderReportId, ...line }));
    });
    return this.withStock(report, product);
  }
  async deleteProduct(id: number) {
    const result = await this.productReports.delete(id);
    if (!result.affected) throw new NotFoundException('Product report not found');
    return { message: 'Product report deleted' };
  }
  async deleteOrder(id: number) {
    // The FK cascades only within reporting_db, never into order_db or product_db.
    const result = await this.orderReports.delete(id);
    if (!result.affected) throw new NotFoundException('Order report not found');
    return { message: 'Order report and linked product reports deleted' };
  }
}

import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { ReportsService } from './reports.service.js';
import { positiveId } from './calculation.js';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('products')
  products(@Headers('authorization') token: string, @Query('product_id') productId?: string) {
    return this.reports.products(token, productId === undefined ? undefined : positiveId(Number(productId), 'product_id'));
  }
  @Get('products/:id')
  product(@Param('id', ParseIntPipe) id: number, @Headers('authorization') token: string) {
    return this.reports.product(positiveId(id), token);
  }
  @Get('orders')
  orders(@Query('order_id') orderId?: string) {
    return this.reports.orders(orderId === undefined ? undefined : positiveId(Number(orderId), 'order_id'));
  }
  @Get('orders/:id')
  order(@Param('id', ParseIntPipe) id: number) { return this.reports.order(positiveId(id)); }

  @Post('products')
  createProduct(@Body() body: unknown, @Headers('authorization') token: string) { return this.reports.createProduct(body, token); }
  @Post('orders')
  createOrder(@Body() body: unknown, @Headers('authorization') token: string) { return this.reports.createOrder(body, token); }

  @Delete('products/:id')
  deleteProduct(@Param('id', ParseIntPipe) id: number) { return this.reports.deleteProduct(positiveId(id)); }
  @Delete('orders/:id')
  deleteOrder(@Param('id', ParseIntPipe) id: number) { return this.reports.deleteOrder(positiveId(id)); }
}

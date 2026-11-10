import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import axios from 'axios';
import { Order } from './entities/order.entity.js';
import { OrderItem } from '../order-item/entities/order-item.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';

@Injectable()
export class OrderService {
  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>) {}
  findAll() { return this.orders.find(); }
  async findOne(id: number) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    const items = await this.orders.manager.find(OrderItem, { where: { order_id: id } });
    return { ...order, items };
  }
  async priceItem(productId: number, quantity: number, token: string, existing = 0) {
    if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1) throw new BadRequestException('product_id and quantity must be positive integers');
    let product;
    try {
      const response = await axios.get(`${process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001'}/products/${productId}`, { headers: { Authorization: token }, timeout: 5000 });
      product = response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) throw new BadRequestException('Product not found');
      throw new ServiceUnavailableException('Product service is unavailable');
    }
    if (quantity + existing > product.quantity) throw new BadRequestException('Insufficient stock');
    const cents = Math.round(Number(product.price) * 100);
    if (!Number.isSafeInteger(cents) || cents < 0 || cents * quantity > 9999999999) throw new BadRequestException('Invalid product price or amount exceeds DECIMAL(10,2)');
    return { product_id: productId, product_name: product.name, quantity, unit_price: cents / 100, total_price: cents * quantity / 100 };
  }
  async recalculate(manager: EntityManager, orderId: number) {
    const items = await manager.find(OrderItem, { where: { order_id: orderId } });
    const total = items.reduce((sum, item) => sum + Math.round(Number(item.total_price) * 100), 0);
    if (total > 9999999999) throw new BadRequestException('Order amount exceeds DECIMAL(10,2)');
    await manager.update(Order, orderId, { total_amount: total / 100 });
  }
  async create(dto: CreateOrderDto, token: string) {
    if (!dto || typeof dto.customer_name !== 'string' || !dto.customer_name.trim() || dto.customer_name.length > 255 || typeof dto.customer_email !== 'string' || dto.customer_email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.customer_email) || !Array.isArray(dto.items) || !dto.items.length) throw new BadRequestException('Customer name, email and nonempty items are required');
    const quantities = new Map<number, number>();
    for (const item of dto.items) {
      if (!item || !Number.isInteger(item.product_id) || item.product_id < 1 || !Number.isInteger(item.quantity) || item.quantity < 1) throw new BadRequestException('Invalid order item');
      quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + item.quantity);
    }
    const items = await Promise.all([...quantities].map(([id, quantity]) => this.priceItem(id, quantity, token)));
    const id = await this.orders.manager.transaction(async manager => {
      const order = await manager.save(Order, manager.create(Order, { customer_name: dto.customer_name.trim(), customer_email: dto.customer_email, total_amount: 0, status: 'pending' }));
      await manager.save(OrderItem, items.map(item => manager.create(OrderItem, { ...item, order_id: order.id })));
      await this.recalculate(manager, order.id);
      return order.id;
    });
    return this.findOne(id);
  }
  async updateStatus(id: number, dto: UpdateOrderStatusDto) {
    if (!dto || !['pending', 'completed', 'cancelled'].includes(dto.status)) throw new BadRequestException('Invalid order status');
    await this.orders.manager.transaction(async manager => {
      const order = await manager.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'pending' && dto.status !== order.status) throw new BadRequestException('Finalized orders cannot change status');
      await manager.update(Order, id, { status: dto.status });
    });
    return this.findOne(id);
  }
  async remove(id: number) {
    await this.orders.manager.transaction(async manager => {
      const order = await manager.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Order not found');
      await manager.delete(OrderItem, { order_id: id });
      await manager.delete(Order, id);
    });
    return { message: 'Order deleted' };
  }
}

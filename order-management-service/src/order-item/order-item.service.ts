import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { OrderItem } from './entities/order-item.entity.js';
import { Order } from '../order/entities/order.entity.js';
import { OrderService } from '../order/order.service.js';
import { CreateOrderItemDto } from './dto/create-order-item.dto.js';
@Injectable()
export class OrderItemService {
  constructor(@InjectRepository(OrderItem) private readonly items: Repository<OrderItem>, private readonly orders: OrderService) {}
  findAll() { return this.items.find(); }
  async findOne(id: number) {
    const item = await this.items.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Order item not found');
    return item;
  }
  async lockOrder(manager: EntityManager, id: number) {
    if (!Number.isInteger(id) || id < 1) throw new BadRequestException('Invalid order_id');
    const order = await manager.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'pending') throw new BadRequestException('Only pending orders can be edited');
  }
  async create(dto: CreateOrderItemDto, token: string) {
    if (!dto) throw new BadRequestException('Item is required');
    return this.items.manager.transaction(async manager => {
      await this.lockOrder(manager, dto.order_id);
      const siblings = await manager.find(OrderItem, { where: { order_id: dto.order_id, product_id: dto.product_id } });
      const priced = await this.orders.priceItem(dto.product_id, dto.quantity, token, siblings.reduce((sum, i) => sum + i.quantity, 0));
      const item = await manager.save(OrderItem, manager.create(OrderItem, { ...priced, order_id: dto.order_id }));
      await this.orders.recalculate(manager, dto.order_id);
      return item;
    });
  }
  async update(id: number, dto: CreateOrderItemDto, token: string) {
    const original = await this.findOne(id);
    if (!dto || (dto.order_id !== undefined && dto.order_id !== original.order_id)) throw new BadRequestException('Cannot move an item to another order');
    return this.items.manager.transaction(async manager => {
      await this.lockOrder(manager, original.order_id);
      const item = await manager.findOne(OrderItem, { where: { id } });
      if (!item) throw new NotFoundException('Order item not found');
      const productId = dto.product_id ?? item.product_id;
      const siblings = await manager.find(OrderItem, { where: { order_id: item.order_id, product_id: productId } });
      const existing = siblings.filter(i => i.id !== id).reduce((sum, i) => sum + i.quantity, 0);
      const priced = await this.orders.priceItem(productId, dto.quantity ?? item.quantity, token, existing);
      Object.assign(item, priced);
      const saved = await manager.save(OrderItem, item);
      await this.orders.recalculate(manager, item.order_id);
      return saved;
    });
  }
  async remove(id: number) {
    const item = await this.findOne(id);
    await this.items.manager.transaction(async manager => {
      await this.lockOrder(manager, item.order_id);
      const current = await manager.findOne(OrderItem, { where: { id } });
      if (!current) throw new NotFoundException('Order item not found');
      await manager.delete(OrderItem, id);
      await this.orders.recalculate(manager, item.order_id);
    });
    return { message: 'Order item deleted' };
  }
}

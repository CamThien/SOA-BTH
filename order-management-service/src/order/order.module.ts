import { OrderItem } from '../order-item/entities/order-item.entity.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { Order } from './entities/order.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem])],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
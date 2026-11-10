import { OrderModule } from '../order/order.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderItemController } from './order-item.controller.js';
import { OrderItemService } from './order-item.service.js';
import { OrderItem } from './entities/order-item.entity.js';

@Module({
  imports: [OrderModule, TypeOrmModule.forFeature([OrderItem])],
  controllers: [OrderItemController],
  providers: [OrderItemService],
})
export class OrderItemModule {}
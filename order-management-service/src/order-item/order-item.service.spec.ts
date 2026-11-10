import { OrderService } from '../order/order.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderItem } from './entities/order-item.entity.js';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderItemService } from './order-item.service.js';

describe('OrderItemService', () => {
  let service: OrderItemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderItemService, { provide: getRepositoryToken(OrderItem), useValue: {} }, { provide: OrderService, useValue: {} }],
    }).compile();

    service = module.get<OrderItemService>(OrderItemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

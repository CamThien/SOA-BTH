import { OrderItemService } from './order-item.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderItemController } from './order-item.controller.js';

describe('OrderItemController', () => {
  let controller: OrderItemController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderItemController],
      providers: [{ provide: OrderItemService, useValue: {} }],
    }).compile();

    controller = module.get<OrderItemController>(OrderItemController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

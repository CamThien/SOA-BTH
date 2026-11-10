import { AuthGuard } from '../auth/auth.guard.js';
import {
  Body,
  Headers,
  UseGuards,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';

import { OrderItemService } from './order-item.service.js';
import { CreateOrderItemDto } from './dto/create-order-item.dto.js';

@UseGuards(AuthGuard)
@Controller('order_items')
export class OrderItemController {
  constructor(
    private readonly orderItemService: OrderItemService,
  ) {}

  @Get()
  findAll() {
    return this.orderItemService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orderItemService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderItemDto,
    @Headers('authorization') token: string) {
    return this.orderItemService.create(dto, token);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderItemDto,
    @Headers('authorization') token: string,
  ) {
    return this.orderItemService.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.orderItemService.remove(id);
  }
}
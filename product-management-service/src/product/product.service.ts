
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  // Lấy danh sách tất cả sản phẩm
  async findAll(): Promise<Product[]> {
    return this.productRepository.find();
  }

  // Lấy thông tin một sản phẩm theo ID
  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm có ID ${id}`);
    }

    return product;
  }

  // Thêm sản phẩm mới
  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(dto);
    return this.productRepository.save(product);
  }

  // Cập nhật sản phẩm
  async update(
    id: number,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    Object.assign(product, dto);

    return this.productRepository.save(product);
  }

  // Xóa sản phẩm
  async remove(id: number): Promise<{ message: string }> {
    const product = await this.findOne(id);

    await this.productRepository.remove(product);

    return { message: 'Xóa sản phẩm thành công' };
  }
}

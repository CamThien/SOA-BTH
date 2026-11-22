import { BadGatewayException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { SourceOrder, SourceProduct } from './calculation.js';

@Injectable()
export class SourceService {
  private async get<T>(base: string, path: string, authorization: string): Promise<T> {
    try {
      const response = await axios.get<T>(`${base.replace(/\/$/, '')}${path}`, { headers: { Authorization: authorization }, timeout: 5000 });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) throw new NotFoundException(`Source resource not found: ${path}`);
        if ([401, 403].includes(error.response?.status || 0)) throw new UnauthorizedException('Source service rejected token');
      }
      throw new ServiceUnavailableException(`Source service unavailable: ${path}`);
    }
  }
  order(id: number, token: string) {
    return this.get<SourceOrder>(process.env.ORDER_SERVICE_URL || 'http://localhost:3002', `/orders/${id}`, token);
  }
  async product(id: number, token: string) {
    const product = await this.get<SourceProduct>(process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001', `/products/${id}`, token);
    if (!product || product.id !== id || !Number.isInteger(product.quantity) || product.quantity < 0 || typeof product.name !== 'string') throw new BadGatewayException('Invalid product response');
    return product;
  }
  async products(token: string) {
    const products = await this.get<SourceProduct[]>(process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001', '/products', token);
    if (!Array.isArray(products) || products.some(p => !p || !Number.isInteger(p.id) || !Number.isInteger(p.quantity) || p.quantity < 0 || typeof p.name !== 'string')) throw new BadGatewayException('Invalid products response');
    return products;
  }
}

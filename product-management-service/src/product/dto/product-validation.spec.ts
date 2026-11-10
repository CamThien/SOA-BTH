import { ValidationPipe } from '@nestjs/common';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

describe('Product input validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it.each(['name', 'price', 'quantity'])('rejects null for %s on update', async (field) => {
    await expect(pipe.transform({ [field]: null }, {
      type: 'body', metatype: UpdateProductDto,
    })).rejects.toThrow();
  });

  it.each([CreateProductDto, UpdateProductDto])('rejects SQL numeric overflow for %p', async (metatype) => {
    for (const invalid of [{ price: 100000000 }, { quantity: 2147483648 }]) {
      await expect(pipe.transform({ name: 'Test', price: 1, quantity: 1, ...invalid }, {
        type: 'body', metatype,
      })).rejects.toThrow();
    }
  });

  it('allows omitted fields and clearing a nullable description', async () => {
    await expect(pipe.transform({ description: null }, {
      type: 'body', metatype: UpdateProductDto,
    })).resolves.toEqual({ description: null });
  });

  it('accepts the SQL numeric limits', async () => {
    const body = { name: 'Test', price: 99999999.99, quantity: 2147483647 };
    await expect(pipe.transform(body, {
      type: 'body', metatype: CreateProductDto,
    })).resolves.toEqual(body);
  });
});

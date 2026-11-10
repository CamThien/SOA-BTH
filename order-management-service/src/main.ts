import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(Number(process.env.PORT || 3002));

  console.log('Order Management Service is running at http://localhost:3002');
}

await bootstrap();
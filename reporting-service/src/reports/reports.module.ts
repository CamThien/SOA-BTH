import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from '../auth/auth.guard.js';
import { OrderReport } from './entities/order-report.entity.js';
import { ProductReport } from './entities/product-report.entity.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { SourceService } from './source.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrderReport, ProductReport])],
  controllers: [ReportsController],
  providers: [AuthGuard, ReportsService, SourceService],
})
export class ReportsModule {}

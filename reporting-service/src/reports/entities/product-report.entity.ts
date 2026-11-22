import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { OrderReport } from './order-report.entity.js';
@Entity('product_reports')
@Index(['order_report_id', 'product_id'], { unique: true })
export class ProductReport {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int' }) order_report_id: number;
  @ManyToOne(() => OrderReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_report_id' }) order_report: Relation<OrderReport>;
  @Column({ type: 'int' }) product_id: number;
  @Column({ type: 'int' }) total_sold: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) revenue: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) cost: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) profit: number;
}

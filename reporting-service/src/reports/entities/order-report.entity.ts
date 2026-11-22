import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('orders_reports')
export class OrderReport {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int' }) order_id: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) total_revenue: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) total_cost: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) total_profit: number;
}

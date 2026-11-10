import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  customer_name: string;

  @Column({ length: 255 })
  customer_email: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  total_amount: number;

  @Column({
    length: 50,
    default: 'pending',
  })
  status: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime2',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime2',
  })
  updated_at: Date;
}
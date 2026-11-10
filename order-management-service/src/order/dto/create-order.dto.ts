export class CreateOrderDto {
  customer_name: string;
  customer_email: string;

  items: {
    product_id: number;
    quantity: number;
  }[];
}
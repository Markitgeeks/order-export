import { json } from '@remix-run/node';
import { getAllOrders } from '../controllers/orderController';

export const loader = async () => {
  const orders = await getAllOrders();
  return json({ orders });
};

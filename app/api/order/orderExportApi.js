import { json } from '@remix-run/node';
import { getAllExportOrders } from '../controllers/orderController';

export const loader = async () => {
  const exportOrders = await getAllExportOrders();
  console.log(exportOrders,"exportOrder")
  return json({ exportOrders });
};

import Orders from '../../model/order';
import ExportHistorys from '../../model/exportHistory';
export const getAllOrders = async () => {
  try {
    
    const orders = await Orders.find({}).lean();
    return orders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};

export const getAllExportOrders = async () => {
  try {
    
    const exportOrders = await ExportHistorys.find({}).lean();
    console.log(exportOrders,"orders")
    return exportOrders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};


import OrderHistory from '../components/OrderHistory';
import { useEffect, useState } from 'react';

export default function AppOrderHistory() {
  const [exportHistories, setExportHistories] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    const fetchExportOrders = async () => {
      try {
        const res = await fetch("/api/export-order");
        if (!res.ok) {
          throw new Error(`Error: ${res.status}`);
        }
        const data = await res.json();
        setExportHistories(data.exportOrders); 
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        setError("Failed to load orders.");
      }
    };
    fetchExportOrders();
  }, []);
  if (error) {
    return <div>{error}</div>;
  }
  return <OrderHistory exportHistories={exportHistories} />;
}

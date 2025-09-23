import OrderManagement from "../components/Order";
import { useEffect, useState } from 'react';

export default function AppOrder() {
  const [orders, setOrders] = useState([]);
    const [error, setError] = useState(null);
    useEffect(() => {
      const fetchOrders = async () => {
        try {
          const res = await fetch("/api/order");
          if (!res.ok) {
            throw new Error(`Error: ${res.status}`);
          }
          const data = await res.json();
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        } catch (err) {
          console.error("Failed to fetch orders:", err);
          setError("Failed to load orders.");
        }
      };
      fetchOrders();
    }, []);
    if (error) {
      return <div>{error}</div>;
    }

  return (
    <>
      <OrderManagement orders={orders || []} />
    </>
  );
}

import { Text } from "@shopify/polaris";
import OrderManagement from "../components/Order";
// import connectDB from "../db.server";
// import { json } from "@remix-run/node";
import { useEffect, useState } from 'react';
// import Order from "../model/order";

// Loader: Sirf MongoDB se orders read karega
// export async function loader() {
//   await connectDB();
//   const orders = await Order.find({}).lean();
//   return json({ orders });
// }

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

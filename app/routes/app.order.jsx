import OrderManagement from "../components/Order";
import { useEffect, useState } from "react";
import { Spinner, EmptySearchResult, InlineStack } from "@shopify/polaris";
export default function AppOrder() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/order");
        if (!res.ok) {
          throw new Error(`Error: ${res.status}`);
        }
        const data = await res.json();
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        setError("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (error) {
    return <div>{error}</div>;
  }
  if (loading) {
    return (
      <InlineStack align="center">
        <Spinner accessibilityLabel="Loading orders" size="large" />
      </InlineStack>
    );
  }

  // 🟢 Empty case
  if (!loading && orders.length === 0) {
    return (
      <div style={{ padding: "40px" }}>
        <EmptySearchResult
          title="No Orders Found"
          description="It looks like you haven’t received any orders yet. New orders will appear here automatically."
          withIllustration
        />
      </div>
    );
  }

  // 🟢 Data available case
  return <OrderManagement orders={orders} />;
}

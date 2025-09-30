import OrderHistory from "../components/OrderHistory";
import { useEffect, useState } from "react";
import { Spinner, EmptySearchResult, EmptyState } from "@shopify/polaris";

export default function AppOrderHistory() {
  const [exportHistories, setExportHistories] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExportOrders = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/export-order");
        if (!res.ok) {
          throw new Error(`Error: ${res.status}`);
        }
        const data = await res.json();
        setExportHistories(
          Array.isArray(data.exportOrders) ? data.exportOrders : [],
        );
      } catch (err) {
        console.error("Failed to fetch order history:", err);
        setError("Failed to load order history.");
      } finally {
        setLoading(false);
      }
    };
    fetchExportOrders();
  }, []);

  // 🟢 Error case
  if (error) {
    return <div>{error}</div>;
  }

  if (loading) {
    return (
      <EmptyState align="center">
        <Spinner accessibilityLabel="Loading order history" size="large" />
      </EmptyState>
    );
  }

  if (!loading && exportHistories.length === 0) {
    return (
      <div style={{ padding: "50px" }}>
        <EmptySearchResult
          title="No Order History Found"
          description="Your export order history is currently empty. Once you export orders, they will appear here."
          withIllustration
        />
      </div>
    );
  }
  return <OrderHistory exportHistories={exportHistories} />;
}

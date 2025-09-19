import OrderManagement from '../components/Order';
import connectDB from "../db.server";
import { json } from '@remix-run/node';
import { useEffect, useState } from 'react';
import { authenticate } from "../shopify.server";
import Order from "../model/order";
import dotenv from "dotenv";
dotenv.config();

function formatShopifyDate(isoDate) {
  const dateObj = new Date(isoDate);
  const optionsTime = {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  };
  return `${dateObj.getDate()} ${dateObj.toLocaleString("en-US", {
    month: "short",
  })} at ${dateObj.toLocaleTimeString("en-US", optionsTime)}`;
}

export async function loader({ request }) {
 const { session } = await authenticate.admin(request);

  if (!session || !session.shop) {
    console.error("No Shopify session found");
    throw new Response("Unauthorized", { status: 401 });
  }
  const shop = session.shop;
  const response = await fetch("/app/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Shop": shop,  
    },
    body: JSON.stringify({ shop }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText}`);
  }

  const { orders } = await response.json();
  console.log(orders,"orders")
  await connectDB();

  for (const order of orders) {
    // prepare line items with properties
    const lineItems = order.line_items.map(item => {
      const props = {};
      const motifCodes = [];

      item.properties?.forEach(prop => {
        if (prop.name && prop.value) {
          props[prop.name] = prop.value;

          // Check if property name starts with "MOTIF CODE"
          if (prop.name.startsWith("MOTIF CODE")) {
            motifCodes.push(prop.value);
          }
        }
      });
      return {
        productCode: item.product_id || "",
        quantity: item.quantity,
        properties: props,
        motifCodes: motifCodes.length ? motifCodes.join(", ") : null
      };
    });
//  await Order.deleteMany({})
    await Order.findOneAndUpdate(
      { id: order.id },
      {
        id: order.id,
        orderNumber: order.name,
        date: formatShopifyDate(order.processed_at),
        refunds: order.refunds?.map(ref => ref.note).filter(Boolean).join(", ") || null,
        customer: `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim(),
        total: `$${order.current_total_price_set?.shop_money?.amount || "0.00"}`,
        paymentStatus: order.financial_status ?
          order.financial_status.charAt(0).toUpperCase() + order.financial_status.slice(1).toLowerCase() :
          "Payment pending",
        fulfillmentStatus: order.fulfillment_status || "Unfulfilled",
        channels: "Online Store",
        items: order.line_items.reduce((acc, i) => acc + (i.current_quantity || 0), 0) || 0,
        tags: order.tags ? order.tags.split(", ").filter(Boolean) : [],
        deliveryMethod: order.shipping_lines?.[0]?.code || "Shipping not required",
        deliveryStatus: order.fulfillment_status || null,
        poNumber: order.po_number || "",
        customerCode: order.customer?.id || "",
        customerOrderRef: order.id || "",
        lineItems: lineItems,
        address: {
          firstName: order.customer?.default_address?.first_name || "",
          lastName: order.customer?.default_address?.last_name || "",
          company: order.customer?.default_address?.company || "",
          address1: order.customer?.default_address?.address1 || "",
          address2: order.customer?.default_address?.address2 || "",
          city: order.customer?.default_address?.city || "",
          province: order.customer?.default_address?.province || "",
          country: order.customer?.default_address?.country || "",
          zip: order.customer?.default_address?.zip || "",
          phone: order.customer?.default_address?.phone || "",
          name: order.customer?.default_address?.name || "",
          provinceCode: order.customer?.default_address?.province_code || "",
          countryCode: order.customer?.default_address?.country_code || "",
          countryName: order.customer?.default_address?.country_name || "",
        }
      },
      { upsert: true, new: true }
    );
  }

  return json({ message: "Orders saved to MongoDB", count: orders.length });
}

export default function AppOrder() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/order");
        if (!res.ok) throw new Error(`Error: ${res.status}`);
        const data = await res.json();
        setOrders(data?.orders || []);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        setError("Failed to load orders.");
      }
    };
    fetchOrders();
  }, []);

  return (
    <>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <OrderManagement orders={orders} />
    </>
  );
}

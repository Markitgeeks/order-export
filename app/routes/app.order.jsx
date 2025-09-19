import OrderManagement from "../components/Order";
import connectDB from "../db.server";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Order from "../model/order";

// Loader: Sirf MongoDB se orders read karega
export async function loader() {
  await connectDB();
  const orders = await Order.find({}).lean();
  return json({ orders });
}

export default function AppOrder() {
  const { orders } = useLoaderData();

  return (
    <>
      <OrderManagement orders={orders || []} />
    </>
  );
}

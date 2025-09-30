import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema({
  productCode: { type: String, default: "" },
  quantity: { type: Number, default: 0 },
  sku:{ type: String, default: "" },
  properties: { type: Map, of: String, default: {} },
});

// 🔹 New Address Schema
const addressSchema = new mongoose.Schema({
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  company: { type: String, default: "" },
  address1: { type: String, default: "" },
  address2: { type: String, default: "" },
  city: { type: String, default: "" },
  province: { type: String, default: "" },
  country: { type: String, default: "" },
  zip: { type: String, default: "" },
  phone: { type: String, default: "" },
  name: { type: String, default: "" },
  provinceCode: { type: String, default: "" },
  countryCode: { type: String, default: "" },
  countryName: { type: String, default: "" },
});

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  orderNumber: { type: String, required: true },
  date: { type: String, required: true },
  customer: { type: String, default: "" },
  total: { type: String, required: true },
  paymentStatus: {
    type: String,
    enum: ["Paid", "Partially paid", "Payment pending"],
    required: true,
  },
  paymentProgress: {
    type: String,
    enum: ["complete", "partiallyComplete", "incomplete"],
    default: "incomplete",
  },
  fulfillmentStatus: {
    type: String,
    enum: ["Fulfilled", "Unfulfilled"],
    required: true,
  },
  fulfillmentProgress: {
    type: String,
    enum: ["complete", "partiallyComplete", "incomplete"],
    default: "incomplete",
  },
  poNumber: { type: String, default: "" },
  items: { type: Number, required: true },
  deliveryStatus: { type: String, default: "" },
  deliveryMethod: {
    type: String,
    enum: ["Shipping", "Express", "Free S", "Pickup in store", "Shipping not required"],
    default: null,
  },
  tags: { type: [String], default: [] },
  invoice: { type: String, default: "" },
  channels: { type: String, default: null },
  refunds: { type: String, default: null },
  customerCode: { type: String, default: "" },
  customerOrderRef: { type: String, default: "" },
  lineItems: [lineItemSchema],
  // 🔹 New field
  address: addressSchema
});

// Prevent model overwrite in dev
const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;

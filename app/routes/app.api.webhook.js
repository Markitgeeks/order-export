import { json } from "@remix-run/node";
import crypto from "crypto";
import connectDB from "../db.server";
import Order from "../model/order";
import dotenv from "dotenv";
dotenv.config();

function verifyShopifyWebhook(request, rawBody) {
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256") || "";
  const generatedHash = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    // ✅ Ensure same length buffers before compare
    return (
      hmacHeader.length > 0 &&
      crypto.timingSafeEqual(
        Buffer.from(generatedHash, "utf8"),
        Buffer.from(hmacHeader, "utf8")
      )
    );
  } catch (e) {
    console.error("HMAC compare failed:", e.message);
    return false;
  }
}

export async function action({ request }) {
  try {
    // ✅ raw body lena
    const rawBody = await request.text();

    // ✅ Verify webhook signature
    const verified = verifyShopifyWebhook(request, rawBody);
    if (!verified) {
      console.error("❌ Webhook signature verification failed");
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Parse payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("❌ Invalid JSON payload:", e.message);
      return json({ error: "Invalid JSON" }, { status: 400 });
    }

    const topic = request.headers.get("x-shopify-topic");
    const shop = request.headers.get("x-shopify-shop-domain");

    console.log("✅ Webhook verified:", topic, shop);

    // ✅ MongoDB connect
    await connectDB();

    function formatShopifyDate(isoDate) {
      const dateObj = new Date(isoDate);
      const optionsTime = { hour: "numeric", minute: "numeric", hour12: true };
      return `${dateObj.getDate()} ${dateObj.toLocaleString("en-US", {
        month: "short",
      })} at ${dateObj.toLocaleTimeString("en-US", optionsTime)}`;
    }

    // ✅ Line items prepare
    const lineItems = payload.line_items?.map((item) => {
      const props = {};
      const motifCodes = [];

      item.properties?.forEach((prop) => {
        if (prop.name && prop.value) {
          props[prop.name] = prop.value;
          if (prop.name.startsWith("MOTIF CODE")) {
            motifCodes.push(prop.value);
          }
        }
      });

      return {
        productCode: item.product_id || "",
        quantity: item.quantity,
        properties: props,
        motifCodes: motifCodes.length ? motifCodes.join(", ") : null,
      };
    }) || [];

    // ✅ Save / Update order in DB
    await Order.findOneAndUpdate(
      { id: payload.id },
      {
        id: payload.id,
        orderNumber: payload.name,
        date: formatShopifyDate(payload.processed_at),
        refunds:
          payload.refunds?.map((ref) => ref.note).filter(Boolean).join(", ") ||
          null,
        customer: `${payload.customer?.first_name || ""} ${
          payload.customer?.last_name || ""
        }`.trim(),
        total:
          payload.current_total_price_set?.shop_money?.amount || "0.00",
        paymentStatus: payload.financial_status
          ? payload.financial_status.charAt(0).toUpperCase() +
            payload.financial_status.slice(1).toLowerCase()
          : "Payment pending",
        fulfillmentStatus: payload.fulfillment_status || "Unfulfilled",
        channels: "Online Store",
        items:
          payload.line_items?.reduce(
            (acc, i) => acc + (i.current_quantity || 0),
            0
          ) || 0,
        tags: payload.tags ? payload.tags.split(", ").filter(Boolean) : [],
        deliveryMethod:
          payload.shipping_lines?.[0]?.code || "Shipping not required",
        deliveryStatus: payload.fulfillment_status || null,
        poNumber: payload.po_number || "",
        customerCode: payload.customer?.id || "",
        customerOrderRef: payload.id || "",
        lineItems: lineItems,
        address: {
          firstName: payload.customer?.default_address?.first_name || "",
          lastName: payload.customer?.default_address?.last_name || "",
          company: payload.customer?.default_address?.company || "",
          address1: payload.customer?.default_address?.address1 || "",
          address2: payload.customer?.default_address?.address2 || "",
          city: payload.customer?.default_address?.city || "",
          province: payload.customer?.default_address?.province || "",
          country: payload.customer?.default_address?.country || "",
          zip: payload.customer?.default_address?.zip || "",
          phone: payload.customer?.default_address?.phone || "",
          name: payload.customer?.default_address?.name || "",
          provinceCode:
            payload.customer?.default_address?.province_code || "",
          countryCode: payload.customer?.default_address?.country_code || "",
          countryName: payload.customer?.default_address?.country_name || "",
        },
      },
      { upsert: true, new: true }
    );

    console.log("📦 Order saved/updated:", payload.id);

    return json({ success: true });
  } catch (err) {
    console.error("❌ Webhook Error:", err.message);
    return json({ error: "Server error" }, { status: 500 });
  }
}

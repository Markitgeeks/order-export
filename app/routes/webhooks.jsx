import Order from '../model/order';
import { authenticate } from '../shopify.server';

export const action = async ({ request }) => {
    const { topic, shop, session, payload } = await authenticate.webhook(request);
    console.log(`:::---Received ${topic} webhook for ${shop}---:::`);
    console.log(payload, '------------------payload');

    if (topic === 'ORDERS_PAID') {
        console.log("executing ::: ORDERS_PAID webhook");
        throw new Response();
    }

    // Shared function to format Shopify date
    function formatShopifyDate(isoDate) {
        const dateObj = new Date(isoDate);
        const optionsTime = { hour: "numeric", minute: "numeric", hour12: true };
        return `${dateObj.getDate()} ${dateObj.toLocaleString("en-US", {
            month: "short",
        })} at ${dateObj.toLocaleTimeString("en-US", optionsTime)}`;
    }

    // Shared function to process line items
    function processLineItems(lineItems) {
        return lineItems.map((item) => {
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
                quantity: item.current_quantity,
                sku:item.sku,
                properties: props,
                motifCodes: motifCodes.length ? motifCodes.join(", ") : null,
            };
        });
    }

    // Shared function to process and save order
    async function saveOrder(payload) {
        const lineItems = processLineItems(payload.line_items);
console.log(payload);
        await Order.findOneAndUpdate(
            { id: payload.id },
            {
                id: payload.id,
                orderNumber: payload.name,
                date: formatShopifyDate(payload.processed_at),
                refunds:
                    payload.refunds?.map((ref) => ref.note).filter(Boolean).join(", ") ||
                    null,
                customer: `${payload.customer?.first_name || ""} ${payload.customer?.last_name || ""}`.trim(),
                total: payload.current_total_price_set?.shop_money?.amount || "0.00",
                paymentStatus: payload.financial_status
                    ? payload.financial_status.charAt(0).toUpperCase() +
                      payload.financial_status.slice(1).toLowerCase()
                    : "Payment pending",
                fulfillmentStatus: payload.fulfillment_status || "Unfulfilled",
                channels: "Online Store",
                items:
                    payload.line_items.reduce(
                        (acc, i) => acc + (i.current_quantity || 0),
                        0
                    ) || 0,
                tags: payload.tags ? payload.tags.split(", ").filter(Boolean) : [],
                deliveryMethod: payload.shipping_lines?.[0]?.code || "Shipping not required",
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
                    provinceCode: payload.customer?.default_address?.province_code || "",
                    countryCode: payload.customer?.default_address?.country_code || "",
                    countryName: payload.customer?.default_address?.country_name || "",
                },
            },
            { upsert: true, new: true }
        );
    }

    switch (topic) {
        case 'ORDERS_CREATE':
            console.log("executing ::: ORDERS_CREATE webhook");
            await saveOrder(payload);
            break;
        case 'ORDERS_UPDATED':
            console.log("executing ::: ORDERS_UPDATED webhook");
            await saveOrder(payload);
            break;
        default:
            console.log("--topic--", topic);
            throw new Response('Unhandled webhook topic', { status: 404 });
    }

    throw new Response();
};
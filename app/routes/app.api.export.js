import { json } from '@remix-run/node';
import connectDB from "../db.server";
import ExportHistory from "../model/exportHistory";
import fs from 'fs';
import path from 'path';
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await connectDB();
    const { orders, filters } = await request.json();

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return json({ error: 'No orders to export' }, { status: 400 });
    }

    // Static CSV Headings
    const headers = [
      "CUSTOMER CODE",
      "CUSTOMER ORDER REF",
      "PRODUCT CODE",
      "QUANTITY REQUIRED",
      "BACKGROUND (TAPE) COLOUR",
      "FOREGROUND (TEXT) COLOUR",
      "MOTIF CODE",
      "LINE 1 STYLE CODE",
      "LINE 1 TEXT",
      "LINE 2 STYLE CODE",
      "LINE 2 TEXT",
      "LINE 3 STYLE CODE",
      "LINE 3 TEXT",
      "LINE 4 STYLE CODE",
      "LINE 4 TEXT",
      "LINE 5 STYLE CODE",
      "LINE 5 TEXT",
      "LINE 6 STYLE CODE",
      "LINE 6 TEXT",
      "DELIVERY NAME",
      "DELIVERY ADDRESS LINE 1",
      "DELIVERY ADDRESS LINE 2",
      "DELIVERY ADDRESS LINE 3",
      "DELIVERY ADDRESS LINE 4",
      "DELIVERY COUNTRY",
      "DELIVERY POST CODE",
      "DELIVERY METHOD"
    ];

    // Flatten orders → multiple rows for multiple line items
    const rows = orders.flatMap((o, orderIndex) => {
      if (!o.lineItems || !Array.isArray(o.lineItems)) {
        console.warn(`Order ${orderIndex} has no lineItems`);
        return [];
      }

      return o.lineItems.map((item, itemIndex) => {
        const rawProps = item.properties || {};
        const props = normalizeProps(rawProps);

        const motifCodes = Object.keys(props)
          .filter(key => key.startsWith("motifs")) // lowercase compare
          .map(key => props[key])
          .filter(Boolean);
        const motifValue = motifCodes.join(",") || "";

        return [
          "4670",
          o.name || o.orderNumber || "",
          item.sku || "",
          item.quantity || "",
          props["background color"] || "",
          props["text color"] || "",
          motifValue,
          props["text style"] || props["font style"] || props["select a font for single line text"] || "",
          props["text line 1"] || "",
          props["line 2 style code"] || "",
          props["text line 2"] || "",
          props["line 3 style code"] || "",
          props["text line 3"] || "",
          props["line 4 style code"] || "",
          props["text line 4"] || "",
          props["line 5 style code"] || "",
          props["text line 5"] || "",
          props["line 6 style code"] || "",
          props["text line 6"] || "",
          o.customer || "",
          o.address?.address1 || "",
          o.address?.address2 || "",
          o.address?.address3 || "",
          o.address?.address4 || "",
          o.address?.country || "",
          o.address?.zip || "",
          o.deliveryMethod || ""
        ].map(escapeCsvField).join(',');
      });
    });

    if (rows.length === 0) {
      return json({ error: 'No rows generated for CSV' }, { status: 500 });
    }

    const csv = [headers.join(','), ...rows].join('\n');

    const now = new Date();
    const filename = `orders_${formatForFilename(now)}.csv`;
    const filePath = path.join(process.cwd(), 'public', 'exports', filename);

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');

    // Save export history
    const exportHistory = new ExportHistory({
      filename,
      exported_at: new Date(),
      filters,
      order_count: orders.length,
      file_path: `https://order-export-tjbwx.ondigitalocean.app/exports/${filename}`,
    });
    await exportHistory.save();

    // Tag orders as exported
    for (const order of orders) {
      if (order?.id) {
        try {
          const response = await admin.graphql(
            `#graphql
            mutation orderUpdate($id: ID!, $tags: [String!]!) {
              orderUpdate(input: { id: $id, tags: $tags }) {
                order {
                  id
                  tags
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
            {
              variables: {
                id: `gid://shopify/Order/${order?.id}`,
                tags: ["exported"],
              },
            }
          );

          const data = await response.json();
          if (data.data.orderUpdate.userErrors.length > 0) {
            console.error(`Failed to add tag to order ${order.id}:`, data.data.orderUpdate.userErrors);
          } else {
            console.log(`Successfully added 'exported' tag to order ${order.id}`);
          }
        } catch (error) {
          console.error(`Error updating tags for order ${order.id}:`, error);
        }
      } else {
        console.warn(`Order at index ${orders.indexOf(order)} has no ID`);
      }
    }

    return json({ success: true, filename, filePath: `/exports/${filename}` });
  } catch (error) {
    console.error('Export error:', error);
    return json({ error: 'Failed to export' }, { status: 500 });
  }
};

// ✅ Normalize all props keys to lowercase + trim
function normalizeProps(props) {
  const normalized = {};
  for (const key in props) {
    if (!props.hasOwnProperty(key)) continue;
    normalized[key.toLowerCase().trim()] = props[key];
  }
  return normalized;
}

function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  const needQuotes = s.includes(',') || s.includes('\n') || s.includes('"') || s.includes('\r');
  const escaped = s.replace(/"/g, '""');
  return needQuotes ? `"${escaped}"` : escaped;
}

function formatForFilename(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) return 'all';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}_${hh}${mm}`;
}


import { json } from '@remix-run/node';
import connectDB from "../db.server";
import ExportHistory from "../model/exportHistory";
import fs from 'fs';
import path from 'path';

export const action = async ({ request }) => {
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
        const props = item.properties || {};
console.log(props);
        // 🔹 Collect all MOTIF CODE fields (MOTIF CODE / MOTIF CODE 1 / 2 / 3 ...)
        const motifCodes = Object.keys(props)
          .filter(key => key.startsWith("Motifs"))
          .map(key => props[key])
          .filter(Boolean); // remove null/empty

        // if multiples join with comma
        const motifValue = motifCodes.join(",") || "";

        return [
          o.customerCode || "",
          o.customerOrderRef || o.orderNumber || "",
          item.sku || "",
          item.quantity || "",
          props["Background Color"] || "",
          props["Text Color"] || "",
          motifValue,
          props["Text Style"] || "",
          props["Text line 1"] || "",
          props["LINE 2 STYLE CODE"] || "",
          props["Text line 2"] || "",
          props["LINE 3 STYLE CODE"] || "",
          props["Text line 3"] || "",
          props["LINE 4 STYLE CODE"] || "",
          props["Text line 4"] || "",
          props["LINE 5 STYLE CODE"] || "",
          props["Text line 5"] || "",
          props["LINE 6 STYLE CODE"] || "",
          props["Text line 6"] || "",
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

    const exportHistory = new ExportHistory({
      filename,
      exported_at: new Date(),
      filters,
      order_count: orders.length,
      file_path: `https://order-export-tjbwx.ondigitalocean.app/${filename}`,
    });

    await exportHistory.save();

    return json({ success: true, filename, filePath: `/exports/${filename}` });
  } catch (error) {
    console.error('Export error:', error);
    return json({ error: 'Failed to export' }, { status: 500 });
  }
};

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

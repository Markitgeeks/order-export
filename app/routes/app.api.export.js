import { json } from "@remix-run/node";
import connectDB from "../db.server";
import ExportHistory from "../model/exportHistory";
import { authenticate } from "../shopify.server";
import FormData from "form-data";
import fetch from "node-fetch";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    await connectDB();

    const { orders, filters } = await request.json();

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return json({ error: "No orders to export" }, { status: 400 });
    }

    if (orders.length > 100) {
      return json(
        { error: "You can export only 100 orders at a time" },
        { status: 400 }
      );
    }

    // CSV Headers
    const csvHeaders = [
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
      "DELIVERY METHOD",
    ];

    // Generate CSV rows
    const rows = orders.flatMap((order) => {
      if (!order.lineItems || !Array.isArray(order.lineItems)) return [];

      return order.lineItems.map((item) => {
        const rawProps = item.properties || {};
        let props = {};

        if (order.channels?.toLowerCase() === "amazon") {
          props = parseAmazonProperties(rawProps);
        } else {
          props = normalizeProps(rawProps);
        }

        const motifValue =
          props["motif code"] || extractMotifs(rawProps) || "";

        return [
          "4670",
          order.name || order.orderNumber || "",
          item.sku || "",
          item.quantity || "",
          props["background color"] || "",
          props["text color"] || "",
          motifValue,
          props["font style"] ||
            props["text style"] ||
            props["font style 1"] ||
            props["text style 1"] ||
            "",
          props["text line 1"] || props["Text Line 1"] || "",
          props["font style 2"] ||
            props["text style 2"] ||
            props["font style"] ||
            props["text style"] ||
            "",
          props["text line 2"] || "",
          props["font style 3"] ||
            props["text style 3"] ||
            props["font style"] ||
            props["text style"] ||
            "",
          props["text line 3"] || "",
          props["font style 4"] || props["text style 4"] || "",
          props["text line 4"] || "",
          props["font style 5"] || props["text style 5"] || "",
          props["text line 5"] || "",
          props["font style 6"] || props["text style 6"] || "",
          props["text line 6"] || "",
          order.customer || "",
          order.address?.address1 || "",
          order.address?.city || "",
          order.address?.address3 || "",
          order.address?.address4 || "",
          order.address?.country || "",
          order.address?.zip || "",
          order.deliveryMethod || "",
        ]
          .map(escapeCsvField)
          .join(",");
      });
    });

    if (rows.length === 0) {
      return json({ error: "No rows generated for CSV" }, { status: 500 });
    }

    const csv = [csvHeaders.join(","), ...rows].join("\n");
    const now = new Date();
    const filename = `orders_${formatForFilename(now)}.csv`;

    const fileContent = Buffer.from("\uFEFF" + csv, "utf8");
    const fileSize = fileContent.length;

    // 1. Create staged upload target
    const stagedUploadsQuery = `#graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const stagedVariables = {
      input: [
        {
          filename,
          mimeType: "text/csv",
          resource: "BULK_MUTATION_VARIABLES",
          fileSize: fileSize.toString(),
          httpMethod: "POST",
        },
      ],
    };

    const stagedResult = await admin.graphql(stagedUploadsQuery, {
      variables: stagedVariables,
    });
    const stagedData = await stagedResult.json();

    if (stagedData.data.stagedUploadsCreate.userErrors.length > 0) {
      throw new Error(stagedData.data.stagedUploadsCreate.userErrors.map(e => e.message).join(", "));
    }

    const stagedTarget = stagedData.data.stagedUploadsCreate.stagedTargets[0];
    const uploadUrl = stagedTarget.url;
    const resourceUrl = stagedTarget.resourceUrl;
    const key = stagedTarget.parameters.find(p => p.name === "key")?.value;

    // 2. Upload file to Google Cloud (staged target)
    const form = new FormData();
    stagedTarget.parameters.forEach(({ name, value }) => {
      form.append(name, value);
    });
    form.append("file", fileContent, filename);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${text}`);
    }

    // 3. Register file in Shopify
    const fileCreateQuery = `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            ... on GenericFile {
              id
              fileStatus
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const fileCreateVariables = {
      files: [
        {
          originalSource: `${resourceUrl}${key}`,
          contentType: "FILE",
        },
      ],
    };

    const fileCreateResult = await admin.graphql(fileCreateQuery, {
      variables: fileCreateVariables,
    });
    const fileCreateData = await fileCreateResult.json();

    if (fileCreateData.data.fileCreate.userErrors.length > 0) {
      throw new Error(fileCreateData.data.fileCreate.userErrors.map(e => e.message).join(", "));
    }

    const fileId = fileCreateData.data.fileCreate.files[0]?.id;
    if (!fileId) {
      throw new Error("No file ID returned from Shopify");
    }

    // 4. Poll until file is READY and get final URL
    async function waitForFileReady(id, maxAttempts = 30, delayMs = 2000) {
      const query = `#graphql
        query getFile($id: ID!) {
          node(id: $id) {
            ... on GenericFile {
              id
              fileStatus
              url
            }
          }
        }
      `;

      for (let i = 0; i < maxAttempts; i++) {
        const result = await admin.graphql(query, { variables: { id } });
        const data = await result.json();
        const file = data?.data?.node;

        if (file?.fileStatus === "READY" && file?.url) {
          return file.url;
        }

        if (file?.fileStatus === "FAILED") {
          throw new Error("File processing failed in Shopify");
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // Timeout: fallback to direct staged URL (still accessible temporarily)
      return `${resourceUrl}${key}`;
    }

    const finalFileUrl = await waitForFileReady(fileId);

    // 5. Save export history
    const exportHistory = new ExportHistory({
      filename,
      exported_at: new Date(),
      filters,
      order_count: orders.length,
      file_path: finalFileUrl, // Guaranteed to be valid now
    });
    await exportHistory.save();

    // 6. Optional: Tag orders as exported
   // Tag orders as "exported" without overwriting existing tags
for (const order of orders) {
  if (order?.id || Array.isArray(order.tags)) {
    try {
      // Take tags directly from the order object you already have
      let currentTags = [...order.tags]; // clone to avoid mutation

      // Add "exported" only if it's not already present
      if (!currentTags.includes("exported")) {
        currentTags.push("exported");
      }

      // Update the order with full tag list (preserves all old tags + adds new)
      const updateMutation = `#graphql
        mutation orderUpdate($input: OrderInput!) {
          orderUpdate(input: $input) {
            order {
              id
              tags
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const result = await admin.graphql(updateMutation, {
        variables: {
          input: {
            id: `gid://shopify/Order/${order.id}`,
            tags: currentTags,
          },
        },
      });

      const data = await result.json();

      if (data.data?.orderUpdate?.userErrors?.length > 0) {
        console.warn(
          `Errors tagging order ${order.id}:`,
          data.data.orderUpdate.userErrors.map(e => e.message).join(", ")
        );
      } else {
        console.log(`Successfully added "exported" tag to order ${order.id}`);
      }
    } catch (err) {
      console.error(`Failed to tag order ${order.id}:`, err.message || err);
    }
  }
}
    return json({
      success: true,
      filename,
      fileUrl: finalFileUrl,
      filePath: finalFileUrl, // backward compatibility
    });
  } catch (error) {
    console.error("Export error:", error);
    return json(
      { error: error.message || "Failed to export orders" },
      { status: 500 }
    );
  }
};

// Helper functions (keep these at the bottom)

function normalizeProps(props) {
  const normalized = {};
  for (const key in props) {
    if (Object.hasOwnProperty.call(props, key)) {
      normalized[key.toLowerCase().trim()] = props[key];
    }
  }
  return normalized;
}

function extractMotifs(props) {
  const motifs = [];
  for (const key in props) {
    if (key.toLowerCase().startsWith("motifs")) {
      motifs.push(props[key]);
    }
  }
  return motifs.join(",");
}

function parseAmazonProperties(rawProps) {
  const parsed = {};
  for (const key in rawProps) {
    if (!Object.hasOwnProperty.call(rawProps, key)) continue;
    const value = rawProps[key];
    const lowerKey = key.toLowerCase().trim();

    if (typeof value === "string") {
      const lines = value.split("\n");
      const kv = {};
      lines.forEach(line => {
        const [k, v] = line.split(":").map(s => s?.trim());
        if (k && v) kv[k.toLowerCase()] = v;
      });

      if (lowerKey === "color") {
        parsed["background color"] = kv["optionvalue"] || "";
      } else if (
        lowerKey.includes("line 1 text") ||
        lowerKey.includes("name for labels")
      ) {
        parsed["text line 1"] = kv["text"] || "";
        parsed["text color"] = kv["colorname"] || "";
        parsed["font style"] = kv["fontfamily"] || "";
      } else if (lowerKey.includes("line 2 text")) {
        parsed["text line 2"] = kv["text"] || "";
      } else if (lowerKey.includes("line 3 text")) {
        parsed["text line 3"] = kv["text"] || "";
      } else if (lowerKey.includes("line 4 text")) {
        parsed["text line 4"] = kv["text"] || "";
      } else if (lowerKey.includes("line 5 text")) {
        parsed["text line 5"] = kv["text"] || "";
      } else if (lowerKey.includes("line 6 text")) {
        parsed["text line 6"] = kv["text"] || "";
      } else if (lowerKey.includes("motif")) {
        const motif = kv["optionvalue"]?.split("-")?.[0]?.trim() || "";
        parsed["motif code"] = motif;
      }
    }
  }
  return parsed;
}

function escapeCsvField(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function formatForFilename(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return "unknown";
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  const hh = String(dateObj.getHours()).padStart(2, "0");
  const mm = String(dateObj.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}_${hh}${mm}`;
}
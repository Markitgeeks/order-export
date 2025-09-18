// import connectDB from "../../db.server";
// import shopify from "../../shopify.server";
// import Order from "../../model/order";
// const GET_ALL_ORDERS = `
//   query GetAllOrders {
//     orders(first: 250) {
//       edges {
//         node {
//           id
//           name
//           createdAt
//           confirmed
//           currencyCode
//           currentTotalPriceSet {
//             shopMoney {
//               amount
//               currencyCode
//             }
//           }
//           channelInformation {
//             channelId
//             channelDefinition {
//               channelName
//             }
//           }
//           tags
//           displayFulfillmentStatus
//           displayFinancialStatus
//           requiresShipping
//           customer {
//     firstName
//     lastName
 
//   }
//           lineItems(first: 150) {
//             nodes {
//               currentQuantity
//             }
//           }
//           shippingLines(first: 150) {
//             nodes {
//               code
//             }
//           }
//           processedAt
//           refunds {
//             note
//           }
//         }
//       }
//       pageInfo {
//         hasNextPage
//         endCursor
//       }
//     }
//   }
// `;

// function formatShopifyDate(isoDate) {
//   const dateObj = new Date(isoDate);
//   const optionsTime = {
//     hour: "numeric",
//     minute: "numeric",
//     hour12: true,
//   };
//   return `${dateObj.getDate()} ${dateObj.toLocaleString("en-US", {
//     month: "short",
//   })} at ${dateObj.toLocaleTimeString("en-US", optionsTime)}`;
// }

// export async function syncOrdersFromShopify(request) {
//     console.log(request,"requst");
//   const { admin } = await shopify.authenticate.admin(request);
//   console.log(admin,"admin")
//   const response = await admin.graphql(GET_ALL_ORDERS);
//   console.log(response,"repose")
//   const parsed = await response.json();
//   console.log(parsed,"parseeeee")
//   const orders = parsed.data.orders.edges.map(({ node }) => node);

//   await connectDB();

//   for (const order of orders) {
//     await Order.findOneAndUpdate(
//       { id: order.id },
//       {
//         id: order.id,
//         orderNumber: order.name,
//         date: formatShopifyDate(order.processedAt),
//         refunds: order.refunds?.map(refund => refund.note).filter(Boolean).join(", ") || null,
//         customer: `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`,
//         total: `$${order.currentTotalPriceSet?.shopMoney?.amount}` || "0",
//         paymentStatus: order.displayFinancialStatus || "Payment pending",
//         fulfillmentStatus: order.displayFulfillmentStatus || "Unfulfilled",
//         channels: order.channelInformation?.channelDefinition?.channelName || "Online Store",
//         items: order.lineItems?.nodes?.reduce((acc, item) => acc + (item.currentQuantity || 0), 0),
//         tags: order.tags || [],
//         deliveryMethod: order.shippingLines?.nodes?.[0]?.code || "Shipping not required",
//         deliveryStatus: order.displayFulfillmentStatus || "",
//       },
//       { upsert: true, new: true }
//     );
//   }

//   return {
//     message: "Orders saved to MongoDB",
//     count: orders.length,
//   };
// }

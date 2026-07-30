// Tool definitions (Gemini function declarations) + their server-side executors.
// Each tool reuses the app's shared libs — it never re-implements stock/order
// logic, so the agent obeys the exact same rules as the storefront and POS.
import { Type, type Schema } from "@google/genai";
import type { AgentTool } from "@/lib/agent/run";
import { agentSearchCatalog, agentGetVariant } from "@/lib/catalog";
import { createOnlineOrder, OrderError, type CreateOnlineOrderInput } from "@/lib/online-order";
import { getDeliveryCharges, getPreorderEnabled } from "@/lib/settings";
import { businessSummary, lowStock, deadStock, topProducts } from "@/lib/agent/metrics";
import { getSourcingSettings, calculateSourcingPrice, listSourcingRequests, searchLinks } from "@/lib/sourcing";
import { searchReport } from "@/lib/search-log";

// ── Customer tools ────────────────────────────────────────────────────────────

const searchCatalog: AgentTool = {
  declaration: {
    name: "search_catalog",
    description:
      "Search the published online store for products by name, brand, model, category, or SKU. " +
      "Returns products with their variants, live stock, and price. Use this to answer " +
      "availability, colour, and price questions. Always search before quoting a price or stock.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "What the customer is looking for, e.g. 'Vivo X300 Pro cover' or 'iPhone 16 case'.",
        },
        limit: { type: Type.INTEGER, description: "Max products to return (default 8)." },
      },
      required: ["query"],
    },
  },
  run: async (args) =>
    agentSearchCatalog(String(args.query ?? ""), { limit: Number(args.limit) || undefined }),
};

const getVariant: AgentTool = {
  declaration: {
    name: "get_variant",
    description:
      "Get the live stock and price for one specific variant by its variantId (from search_catalog). " +
      "Call this to confirm a variant is in stock right before placing an order.",
    parameters: {
      type: Type.OBJECT,
      properties: { variantId: { type: Type.STRING, description: "The variantId to check." } },
      required: ["variantId"],
    },
  },
  run: async (args) => {
    const v = await agentGetVariant(String(args.variantId ?? ""));
    return v ?? { error: "No such variant, or it is not available online." };
  },
};

const deliveryCharges: AgentTool = {
  declaration: {
    name: "delivery_charges",
    description:
      "Get the shop's delivery charges (Inside Dhaka / Outside Dhaka), in BDT taka. " +
      "Use this when quoting a total that includes delivery.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  run: async () => getDeliveryCharges(),
};

// Shared parameter schema for both ordering tools.
const ORDER_PARAMS: Schema = {
  type: Type.OBJECT,
  properties: {
    customerName: { type: Type.STRING, description: "Customer's full name." },
    phone: { type: Type.STRING, description: "11-digit Bangladeshi phone, starts 01." },
    address: { type: Type.STRING, description: "Full delivery address." },
    area: {
      type: Type.STRING,
      enum: ["INSIDE_DHAKA", "OUTSIDE_DHAKA"],
      description: "Delivery zone (affects delivery charge).",
    },
    payMethod: {
      type: Type.STRING,
      enum: ["COD", "BKASH", "NAGAD"],
      description: "COD = cash on delivery. BKASH/NAGAD require a payReference.",
    },
    payReference: {
      type: Type.STRING,
      description: "bKash/Nagad transaction ID — required if payMethod is BKASH or NAGAD.",
    },
    note: { type: Type.STRING, description: "Optional order note." },
    items: {
      type: Type.ARRAY,
      description: "The variants to order.",
      items: {
        type: Type.OBJECT,
        properties: {
          variantId: { type: Type.STRING, description: "variantId from search_catalog." },
          quantity: { type: Type.INTEGER, description: "How many (1–5)." },
        },
        required: ["variantId", "quantity"],
      },
    },
  },
  required: ["customerName", "phone", "address", "area", "payMethod", "items"],
};

const placeOrder: AgentTool = {
  declaration: {
    name: "place_order",
    description:
      "Place a Cash-on-Delivery or prepaid online order for an IN-STOCK item. Only call this after the " +
      "customer has confirmed the exact product(s), their name, phone, full address, and area. " +
      "Prices come from the database automatically — you do not set them. Returns an order number.",
    parameters: ORDER_PARAMS,
  },
  run: async (args) => {
    try {
      const order = await createOnlineOrder(args as unknown as CreateOnlineOrderInput);
      return {
        ok: true,
        orderNo: order.orderNo,
        grandTotal: Number(order.grandTotal),
        deliveryCharge: Number(order.deliveryCharge),
        status: order.status,
        message: `Order ${order.orderNo} placed. Total ৳${Number(order.grandTotal)} (incl. delivery).`,
      };
    } catch (e) {
      if (e instanceof OrderError) return { ok: false, error: e.message };
      throw e;
    }
  },
};

const placePreorder: AgentTool = {
  declaration: {
    name: "place_preorder",
    description:
      "Place a PRE-ORDER for an item that is currently OUT OF STOCK — the customer orders now and " +
      "receives it when the shop restocks. Use only after confirming the item is out of stock, the " +
      "customer agreed to pre-order, and you have the same details as a normal order. If pre-orders " +
      "are turned off, this returns an error — then tell the customer politely and offer a human.",
    parameters: ORDER_PARAMS,
  },
  run: async (args) => {
    if (!(await getPreorderEnabled()))
      return { ok: false, error: "Pre-orders are not available right now." };
    try {
      const order = await createOnlineOrder(args as unknown as CreateOnlineOrderInput, { preorder: true });
      return {
        ok: true,
        preorder: true,
        orderNo: order.orderNo,
        grandTotal: Number(order.grandTotal),
        deliveryCharge: Number(order.deliveryCharge),
        status: order.status,
        message: `Pre-order ${order.orderNo} placed. We'll contact you when it arrives. Total ৳${Number(order.grandTotal)} (incl. delivery).`,
      };
    } catch (e) {
      if (e instanceof OrderError) return { ok: false, error: e.message };
      throw e;
    }
  },
};

const requestHuman: AgentTool = {
  declaration: {
    name: "request_human",
    description:
      "Hand the conversation over to a human staff member when you cannot help, the customer asks " +
      "for a person, or the request is a complaint/negotiation beyond stock and orders.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: "Short reason for the handoff." },
      },
      required: ["reason"],
    },
  },
  // Handoff delivery (owner notification) is wired up with the messaging
  // channels. For now, acknowledge so the agent tells the customer politely.
  run: async (args) => ({
    ok: true,
    handedOff: true,
    reason: String(args.reason ?? ""),
    message: "A staff member will follow up with the customer shortly.",
  }),
};

export const customerTools: AgentTool[] = [
  searchCatalog,
  getVariant,
  deliveryCharges,
  placeOrder,
  placePreorder,
  requestHuman,
];

// ── Owner tools ───────────────────────────────────────────────────────────────

const businessSummaryTool: AgentTool = {
  declaration: {
    name: "business_summary",
    description:
      "Get today's and this month's sales: order count, revenue, amount paid, amount due, and gross " +
      "profit (all in BDT). Use for 'how are sales today', 'today's profit', etc.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  run: async () => businessSummary(),
};

const lowStockTool: AgentTool = {
  declaration: {
    name: "low_stock",
    description: "List product variants at or below their reorder level (need restocking).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  run: async () => lowStock(),
};

const deadStockTool: AgentTool = {
  declaration: {
    name: "dead_stock",
    description:
      "List in-stock variants that have NOT sold in the last N days (dead stock / not selling).",
    parameters: {
      type: Type.OBJECT,
      properties: { days: { type: Type.INTEGER, description: "Look-back window in days (default 30)." } },
    },
  },
  run: async (args) => deadStock(Number(args.days) || 30),
};

const topProductsTool: AgentTool = {
  declaration: {
    name: "top_products",
    description: "List the best-selling variants (by units sold) over the last N days.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days: { type: Type.INTEGER, description: "Look-back window in days (default 30)." },
        limit: { type: Type.INTEGER, description: "How many to return (default 10)." },
      },
    },
  },
  run: async (args) => topProducts(Number(args.days) || 30, Number(args.limit) || 10),
};

const sourcingQuoteTool: AgentTool = {
  declaration: {
    name: "sourcing_quote",
    description:
      "Calculate the customer price for an item sourced from Taobao / Pinduoduo / 1688, given its price " +
      "in Chinese Yuan (RMB / ¥). Applies the shop's exchange rate + flat shipping + flat profit, then " +
      "rounds UP to a clean number. Use when the owner says e.g. 'cover is 15 yuan, what do I charge?'. " +
      "Always tell the owner the finalPrice (the rounded number), not the raw total.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        rmb: { type: Type.NUMBER, description: "The Taobao/PDD/1688 price in Chinese Yuan (RMB / ¥)." },
        shipping: { type: Type.NUMBER, description: "Optional: override the flat shipping fee (৳) for this item." },
        profit: { type: Type.NUMBER, description: "Optional: override the flat profit (৳) for this item." },
      },
      required: ["rmb"],
    },
  },
  run: async (args) => {
    const rmb = Number(args.rmb);
    if (!Number.isFinite(rmb) || rmb <= 0) return { error: "Enter a valid Yuan (RMB) price." };
    const s = await getSourcingSettings();
    return calculateSourcingPrice(rmb, s, {
      shipping: args.shipping != null ? Number(args.shipping) : undefined,
      profit: args.profit != null ? Number(args.profit) : undefined,
    });
  },
};

const sourcingRequestsTool: AgentTool = {
  declaration: {
    name: "list_sourcing_requests",
    description:
      "List recent customer photo sourcing requests (covers/accessories customers asked the AI to find " +
      "on Taobao/Pinduoduo). Each includes the image analysis, Chinese + English search keywords, and " +
      "ready-to-tap Taobao/1688/Pinduoduo search links. Use when the owner asks about pending sourcing " +
      "or wants what to search for.",
    parameters: {
      type: Type.OBJECT,
      properties: { limit: { type: Type.INTEGER, description: "How many recent requests (default 10)." } },
    },
  },
  run: async (args) => {
    const reqs = await listSourcingRequests(Number(args.limit) || 10);
    return reqs.map((r) => ({
      when: new Date(r.createdAt).toISOString(),
      channel: r.channel,
      customer: r.customerName || r.externalId,
      phoneModel: r.phoneModel || "(unknown)",
      description: r.description,
      keywordsChinese: r.keywordsChinese,
      keywordsEnglish: r.keywordsEnglish,
      searchLinks: searchLinks(r.keywordsChinese || r.keywordsEnglish),
      photoUrl: r.photoUrl,
      status: r.status,
    }));
  },
};

const searchReportTool: AgentTool = {
  declaration: {
    name: "search_report",
    description:
      "Report what customers searched for on the website store — the top searches AND, most importantly, " +
      "searches that returned NO results (unmet demand: what people want that you don't stock/publish). " +
      "Use for 'what are people searching', 'what's in demand', 'today's searches', 'what should I stock'.",
    parameters: {
      type: Type.OBJECT,
      properties: { days: { type: Type.INTEGER, description: "Look-back window in days (default 1 = last 24h). Use 7 for the week, 30 for the month." } },
    },
  },
  run: async (args) => searchReport(Math.max(1, Number(args.days) || 1)),
};

export const ownerTools: AgentTool[] = [
  businessSummaryTool,
  lowStockTool,
  deadStockTool,
  topProductsTool,
  sourcingQuoteTool,
  sourcingRequestsTool,
  searchReportTool,
  searchCatalog, // owners can also look up stock/price
];

// Shared catalog + stock reads. ONE implementation of the stock formula so the
// storefront (`/api/shop/products`), the checkout, and the AI agent all agree.
//
// Stock rule (matches the rest of the app):
//   SERIALIZED products (phones/IMEI) → count of SerialUnit rows IN_STOCK.
//   STANDARD products (accessories)   → sum of StockLevel.quantity across outlets.
import { prisma } from "@/lib/prisma";

// Public storefront base for shareable product links (set STOREFRONT_URL to your
// domain, e.g. https://exceltech.com.bd, once it serves the shop).
const STOREFRONT = (process.env.STOREFRONT_URL || "https://exceltechpos.netlify.app").replace(/\/$/, "");
export const productUrl = (slug: string) => `${STOREFRONT}/shop/${slug}`;

// Include used everywhere we need to compute a published variant's stock.
export const PUBLISHED_VARIANT_INCLUDE = {
  color: true,
  size: true,
  stockLevels: true,
  _count: { select: { serialUnits: { where: { status: "IN_STOCK" as const } } } },
} as const;

type StockableVariant = {
  stockLevels: { quantity: number }[];
  _count: { serialUnits: number };
};

/** On-hand quantity for a single variant, given its product's tracking type. */
export function variantStock(productType: string, v: StockableVariant): number {
  return productType === "SERIALIZED"
    ? v._count.serialUnits
    : v.stockLevels.reduce((s, x) => s + x.quantity, 0);
}

// ── Storefront reads (back the /api/shop/products route) ──────────────────────

/** Full published catalog list + the brands that have published products. */
export async function listPublishedProducts(opts: { q?: string; brand?: string } = {}) {
  const q = opts.q?.trim() ?? "";
  const brand = opts.brand?.trim() ?? "";
  const [products, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        isPublished: true,
        isActive: true,
        ...(brand ? { brand: { name: brand } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { brand: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      include: {
        brand: true,
        variants: { where: { isActive: true }, include: PUBLISHED_VARIANT_INCLUDE },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.brand.findMany({
      where: { products: { some: { isPublished: true, isActive: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return { products, brands };
}

/** A single published product by storefront slug (null if not found/unpublished). */
export function getPublishedProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isPublished: true, isActive: true },
    include: {
      brand: true,
      category: true,
      warrantyPolicy: true,
      variants: { where: { isActive: true }, include: PUBLISHED_VARIANT_INCLUDE },
    },
  });
}

// ── Agent-facing reads (compact, JSON-friendly shapes for the LLM) ─────────────

export type AgentVariant = {
  variantId: string;
  sku: string;
  label: string; // "Black · 8/256" style, or "" when no color/size
  price: number; // online price if set, else retail sale price (taka, whole units)
  mrp: number | null;
  stock: number;
  inStock: boolean;
};

export type AgentProduct = {
  name: string;
  slug: string;
  url: string; // shareable storefront link
  brand: string | null;
  type: "SERIALIZED" | "STANDARD";
  description: string | null;
  variants: AgentVariant[];
};

/**
 * Search the PUBLISHED catalog for the agent. Returns compact product/variant
 * shapes with live stock and price — never raw Prisma objects (Decimals, etc.).
 */
export async function agentSearchCatalog(
  query: string,
  opts: { limit?: number } = {}
): Promise<AgentProduct[]> {
  const q = query.trim();
  const products = await prisma.product.findMany({
    where: {
      isPublished: true,
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { brand: { name: { contains: q, mode: "insensitive" } } },
              { category: { name: { contains: q, mode: "insensitive" } } },
              { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      brand: true,
      variants: { where: { isActive: true }, include: PUBLISHED_VARIANT_INCLUDE },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts.limit ?? 8, 1), 20),
  });

  return products.map((p) => ({
    name: p.name,
    slug: p.slug,
    url: productUrl(p.slug),
    brand: p.brand?.name ?? null,
    type: p.type as "SERIALIZED" | "STANDARD",
    description: p.description,
    variants: p.variants.map((v) => {
      const stock = variantStock(p.type, v);
      return {
        variantId: v.id,
        sku: v.sku,
        label: [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
        price: Number(v.onlinePrice ?? v.salePrice),
        mrp: v.mrp != null ? Number(v.mrp) : null,
        stock,
        inStock: stock > 0,
      };
    }),
  }));
}

/**
 * Recommend published, in-stock products within a budget (price range). Works
 * for phones and accessories. Optional `category` matches category or product
 * name (e.g. "phone", "cover", "charger"). Returns products with only the
 * variants that fit the budget, cheapest first.
 */
export async function agentProductsByBudget(opts: {
  maxPrice: number;
  minPrice?: number;
  category?: string;
  limit?: number;
}): Promise<AgentProduct[]> {
  const { maxPrice, minPrice = 0, category, limit = 8 } = opts;
  const cat = category?.trim();
  const products = await prisma.product.findMany({
    where: {
      isPublished: true,
      isActive: true,
      ...(cat
        ? {
            OR: [
              { name: { contains: cat, mode: "insensitive" } },
              { category: { name: { contains: cat, mode: "insensitive" } } },
              { brand: { name: { contains: cat, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      brand: true,
      variants: { where: { isActive: true }, include: PUBLISHED_VARIANT_INCLUDE },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const priceOf = (v: { onlinePrice: unknown; salePrice: unknown }) => Number(v.onlinePrice ?? v.salePrice);
  const result = products
    .map((p) => {
      const variants = p.variants
        .map((v) => {
          const stock = variantStock(p.type, v);
          return {
            variantId: v.id,
            sku: v.sku,
            label: [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
            price: priceOf(v),
            mrp: v.mrp != null ? Number(v.mrp) : null,
            stock,
            inStock: stock > 0,
          };
        })
        .filter((v) => v.inStock && v.price >= minPrice && v.price <= maxPrice);
      return {
        name: p.name,
        slug: p.slug,
        url: productUrl(p.slug),
        brand: p.brand?.name ?? null,
        type: p.type as "SERIALIZED" | "STANDARD",
        description: p.description,
        variants,
      };
    })
    .filter((p) => p.variants.length > 0);

  const cheapest = (p: AgentProduct) => Math.min(...p.variants.map((v) => v.price));
  return result.sort((a, b) => cheapest(a) - cheapest(b)).slice(0, Math.min(Math.max(limit, 1), 20));
}

/** Look up one published variant (by id) with live stock — used before ordering. */
export async function agentGetVariant(variantId: string): Promise<
  (AgentVariant & { productName: string; slug: string }) | null
> {
  const v = await prisma.productVariant.findFirst({
    where: { id: variantId, isActive: true, product: { isPublished: true, isActive: true } },
    include: { product: true, ...PUBLISHED_VARIANT_INCLUDE },
  });
  if (!v) return null;
  const stock = variantStock(v.product.type, v);
  return {
    variantId: v.id,
    sku: v.sku,
    label: [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
    price: Number(v.onlinePrice ?? v.salePrice),
    mrp: v.mrp != null ? Number(v.mrp) : null,
    stock,
    inStock: stock > 0,
    productName: v.product.name,
    slug: v.product.slug,
  };
}

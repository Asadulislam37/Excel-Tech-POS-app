// One-off import of the Excel Tech active-product list (import-products.json,
// converted from Active-Product.xlsx). Run: npx tsx prisma/import-products.ts
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Row = { sku: string; category: string; brand: string; name: string; wholesale: number; rp: number; mrp: number; warranty: string };

// Phone categories are IMEI-tracked; everything else is quantity-tracked.
const SERIALIZED_CATS = new Set(["Used Device", "Used Exchange", "New Phone"]);

const WARRANTY_DAYS: Record<string, number> = {
  "No Warranty": 0, "3 Months": 91, "6 Months": 183, "12 Months": 365, "18 Months": 548,
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(join(__dirname, "import-products.json"), "utf8"));
  console.log(`Importing ${rows.length} products…`);

  const brandId: Record<string, string> = {};
  for (const name of [...new Set(rows.map((r) => r.brand).filter(Boolean))]) {
    brandId[name] = (await prisma.brand.upsert({ where: { name }, update: {}, create: { name } })).id;
  }
  const catId: Record<string, string> = {};
  for (const name of [...new Set(rows.map((r) => r.category).filter(Boolean))]) {
    catId[name] = (await prisma.category.upsert({ where: { name }, update: {}, create: { name } })).id;
  }
  const warrId: Record<string, string> = {};
  for (const name of [...new Set(rows.map((r) => r.warranty).filter(Boolean))]) {
    warrId[name] = (await prisma.warrantyPolicy.upsert({
      where: { name }, update: {},
      create: { name, durationDays: WARRANTY_DAYS[name] ?? 365 },
    })).id;
  }
  console.log(`Upserted ${Object.keys(brandId).length} brands, ${Object.keys(catId).length} categories, ${Object.keys(warrId).length} warranty policies.`);

  let created = 0, skipped = 0;
  for (const r of rows) {
    if (!r.sku || !r.name) { skipped++; continue; }
    const existing = await prisma.productVariant.findUnique({ where: { sku: r.sku } });
    if (existing) { skipped++; continue; } // already imported — safe to re-run

    await prisma.product.create({
      data: {
        name: r.name,
        slug: `${slugify(r.name).slice(0, 60)}-${slugify(r.sku)}`,
        type: SERIALIZED_CATS.has(r.category) ? "SERIALIZED" : "STANDARD",
        brandId: brandId[r.brand],
        categoryId: catId[r.category],
        warrantyPolicyId: r.warranty ? warrId[r.warranty] : undefined,
        variants: {
          create: {
            sku: r.sku,
            costPrice: r.wholesale,
            salePrice: r.rp || r.mrp, // POS price: retail if given, else MRP
            mrp: r.mrp || undefined,
          },
        },
      },
    });
    created++;
    if (created % 100 === 0) console.log(`  …${created} created`);
  }

  // Hide the demo seed products so the list shows only the real catalog.
  const importedSkus = rows.map((r) => r.sku);
  const demo = await prisma.product.updateMany({
    where: { isActive: true, variants: { every: { sku: { notIn: importedSkus } } } },
    data: { isActive: false },
  });

  console.log(`Done: ${created} created, ${skipped} skipped (already present/invalid), ${demo.count} demo products deactivated.`);
}

main().finally(() => prisma.$disconnect());

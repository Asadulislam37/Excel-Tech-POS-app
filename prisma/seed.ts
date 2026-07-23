import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Outlet
  const outlet = await prisma.outlet.upsert({
    where: { id: "outlet-shyamoli" },
    update: {},
    create: {
      id: "outlet-shyamoli",
      name: "Excel Tech — Shyamoli Square",
      address: "Shyamoli Square Shopping Mall, Dhaka",
      isDefault: true,
    },
  });

  // Brands
  const brandNames = ["Samsung", "Xiaomi", "Apple", "Realme", "Oppo", "Vivo", "Infinix", "Tecno", "Anker", "Baseus", "JBL"];
  const brands: Record<string, string> = {};
  for (const name of brandNames) {
    const b = await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
    brands[name] = b.id;
  }

  // Categories
  const catNames = ["Smartphone", "Feature Phone", "Tablet", "Charger & Cable", "Earbuds & Headphone", "Power Bank", "Cover & Protector", "Smart Watch", "Speaker"];
  const cats: Record<string, string> = {};
  for (const name of catNames) {
    const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    cats[name] = c.id;
  }

  // Colors
  const colorDefs = [["Black", "#111111"], ["White", "#f5f5f5"], ["Blue", "#2563eb"], ["Green", "#16a34a"], ["Gold", "#d4af37"], ["Purple", "#7c3aed"], ["Silver", "#c0c0c0"]];
  const colors: Record<string, string> = {};
  for (const [name, hex] of colorDefs) {
    const c = await prisma.color.upsert({ where: { name }, update: {}, create: { name, hex } });
    colors[name] = c.id;
  }

  // Sizes (storage)
  const sizeNames = ["4/64", "6/128", "8/128", "8/256", "12/256", "128GB", "256GB"];
  const sizes: Record<string, string> = {};
  for (const name of sizeNames) {
    const s = await prisma.size.upsert({ where: { name }, update: {}, create: { name } });
    sizes[name] = s.id;
  }

  // Units
  for (const name of ["pcs", "box", "set"]) {
    await prisma.unit.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Warranty policies
  const w1y = await prisma.warrantyPolicy.upsert({
    where: { name: "1 Year Official" }, update: {},
    create: { name: "1 Year Official", durationDays: 365, description: "Official brand warranty" },
  });
  const w6m = await prisma.warrantyPolicy.upsert({
    where: { name: "6 Month Shop" }, update: {},
    create: { name: "6 Month Shop", durationDays: 182, description: "Excel Tech shop warranty" },
  });

  // Supplier
  const supplier = await prisma.supplier.upsert({
    where: { id: "sup-motaleb" }, update: {},
    create: { id: "sup-motaleb", name: "Motaleb Plaza Wholesale", phone: "01700000000", address: "Motaleb Plaza, Hatirpool, Dhaka" },
  });

  // Sample serialized product — Redmi Note 13
  const note13 = await prisma.product.upsert({
    where: { slug: "redmi-note-13" }, update: {},
    create: {
      name: "Redmi Note 13", slug: "redmi-note-13", type: "SERIALIZED",
      brandId: brands["Xiaomi"], categoryId: cats["Smartphone"], warrantyPolicyId: w1y.id,
      isPublished: true,
      variants: {
        create: [
          { sku: "RN13-BLK-8128", colorId: colors["Black"], sizeId: sizes["8/128"], costPrice: 21500, salePrice: 23999 },
          { sku: "RN13-BLU-8256", colorId: colors["Blue"], sizeId: sizes["8/256"], costPrice: 24500, salePrice: 26999 },
        ],
      },
    },
    include: { variants: true },
  });

  // Sample standard product — charger
  await prisma.product.upsert({
    where: { slug: "anker-nano-20w" }, update: {},
    create: {
      name: "Anker Nano 20W Charger", slug: "anker-nano-20w", type: "STANDARD",
      brandId: brands["Anker"], categoryId: cats["Charger & Cable"], warrantyPolicyId: w6m.id,
      isPublished: true,
      variants: { create: [{ sku: "ANK-NANO-20W", colorId: colors["White"], costPrice: 1150, salePrice: 1490 }] },
    },
  });

  // Stock for the charger
  const chargerVariant = await prisma.productVariant.findUnique({ where: { sku: "ANK-NANO-20W" } });
  if (chargerVariant) {
    await prisma.stockLevel.upsert({
      where: { variantId_outletId: { variantId: chargerVariant.id, outletId: outlet.id } },
      update: { quantity: 25 },
      create: { variantId: chargerVariant.id, outletId: outlet.id, quantity: 25 },
    });
  }

  // Demo IMEIs for the black Note 13
  const blackVariant = note13.variants.find((v) => v.sku === "RN13-BLK-8128");
  if (blackVariant) {
    const demoSerials = ["356938104263201", "356938104263202", "356938104263203"];
    for (const serialNo of demoSerials) {
      await prisma.serialUnit.upsert({
        where: { serialNo }, update: {},
        create: { serialNo, variantId: blackVariant.id, outletId: outlet.id, costPrice: 21500 },
      });
    }
    await prisma.stockLevel.upsert({
      where: { variantId_outletId: { variantId: blackVariant.id, outletId: outlet.id } },
      update: { quantity: demoSerials.length },
      create: { variantId: blackVariant.id, outletId: outlet.id, quantity: demoSerials.length },
    });
  }

  // Reward setup: 1 point per ৳100, redeem 1 point = ৳0.50
  const existingSetup = await prisma.rewardSetup.findFirst();
  if (!existingSetup) {
    await prisma.rewardSetup.create({ data: { pointsPerTaka: 0.01, takaPerPoint: 0.5, minRedeemPoints: 100 } });
  }

  console.log("Seed complete:", { outlet: outlet.name, supplier: supplier.name });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const prods = await prisma.product.findMany({ include: { variants: true } });
console.log("remaining products:", prods.map(p=>p.name));
for (const p of prods) {
  for (const v of p.variants) { await prisma.stockLedger.deleteMany({ where: { variantId: v.id } }); await prisma.stockLevel.deleteMany({ where: { variantId: v.id } }); await prisma.serialUnit.deleteMany({ where: { variantId: v.id } }); }
  await prisma.productVariant.deleteMany({ where: { productId: p.id } });
  await prisma.product.delete({ where: { id: p.id } });
}
console.log("products now:", await prisma.product.count(), "| customers:", await prisma.customer.count(), "| sales:", await prisma.sale.count());
await prisma.$disconnect();

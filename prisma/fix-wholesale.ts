// One-off: the xlsx "Wholesale" column was imported into costPrice.
// Copy it to the new wholesalePrice field (costPrice stays as an estimate
// until real costing prices are entered).
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "ProductVariant" SET "wholesalePrice" = "costPrice" WHERE "wholesalePrice" IS NULL AND "costPrice" > 0`
  );
  console.log(`Updated ${n} variants.`);
}
main().finally(() => prisma.$disconnect());

// Seeds the chart of accounts used by vouchers, ledgers and reports.
// Safe to re-run: accounts are upserted by code.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// [code, name, type, isSystem] — system accounts are posted to automatically.
const ACCOUNTS: [string, string, "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE", boolean][] = [
  ["1000", "Cash in Hand", "ASSET", true],
  ["1010", "bKash", "ASSET", true],
  ["1020", "Nagad", "ASSET", true],
  ["1030", "Rocket", "ASSET", true],
  ["1040", "Card / Bank", "ASSET", true],
  ["1100", "Accounts Receivable (Customer Due)", "ASSET", true],
  ["1200", "Inventory", "ASSET", true],
  ["2000", "Accounts Payable (Supplier Due)", "LIABILITY", true],
  ["3000", "Owner's Equity", "EQUITY", false],
  ["4000", "Sales Revenue", "INCOME", true],
  ["4100", "Other Income", "INCOME", false],
  ["5000", "Cost of Goods Sold", "EXPENSE", true],
  ["5100", "Shop Rent", "EXPENSE", false],
  ["5200", "Salary & Wages", "EXPENSE", false],
  ["5300", "Electricity & Utilities", "EXPENSE", false],
  ["5400", "Transport & Delivery", "EXPENSE", false],
  ["5500", "Marketing & Advertising", "EXPENSE", false],
  ["5600", "Mobile & Internet", "EXPENSE", false],
  ["5700", "Repair & Maintenance", "EXPENSE", false],
  ["5900", "Other Expense", "EXPENSE", false],
];

async function main() {
  for (const [code, name, type, isSystem] of ACCOUNTS) {
    await prisma.account.upsert({
      where: { code },
      update: { name, type, isSystem },
      create: { code, name, type, isSystem },
    });
  }
  console.log(`Chart of accounts ready: ${ACCOUNTS.length} accounts.`);
}

main().finally(() => prisma.$disconnect());

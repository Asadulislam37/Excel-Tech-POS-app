import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET /api/stock-ledger?q=&reason=&page=1  — every stock movement, newest first
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const reason = p.get("reason") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where = {
    ...(reason && { reason: reason as Prisma.StockLedgerWhereInput["reason"] }),
    ...(q && {
      variant: {
        OR: [
          { sku: { contains: q, mode: "insensitive" as const } },
          { product: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      },
    }),
  };

  const [total, rows] = await Promise.all([
    prisma.stockLedger.count({ where }),
    prisma.stockLedger.findMany({
      where,
      include: { variant: { include: { product: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
  ]);

  return NextResponse.json({
    total,
    rows: rows.map((r) => ({
      id: r.id, createdAt: r.createdAt, sku: r.variant.sku, name: r.variant.product.name,
      reason: r.reason, quantity: r.quantity, balance: r.balance,
      refType: r.refType ?? "",
    })),
  });
}

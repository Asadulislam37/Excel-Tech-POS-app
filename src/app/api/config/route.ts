import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [brands, categories, colors, sizes, warranties, suppliers] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.color.findMany({ orderBy: { name: "asc" } }),
    prisma.size.findMany({ orderBy: { name: "asc" } }),
    prisma.warrantyPolicy.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ brands, categories, colors, sizes, warranties, suppliers });
}

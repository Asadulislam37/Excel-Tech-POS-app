import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDeliveryCharges } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [brands, categories, colors, sizes, units, warranties, suppliers, outlets, delivery] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.color.findMany({ orderBy: { name: "asc" } }),
    prisma.size.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.warrantyPolicy.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.outlet.findMany({ orderBy: { name: "asc" } }),
    getDeliveryCharges(),
  ]);
  // Config changes rarely — let the browser reuse it across page navigations.
  return NextResponse.json(
    { brands, categories, colors, sizes, units, warranties, suppliers, outlets, delivery },
    { headers: { "Cache-Control": "private, max-age=120" } }
  );
}

// POST /api/config { kind: "brand"|"category"|"color"|"size"|"unit"|"warranty", name, durationDays? }
// Quick-add a config entry from the product form.
export async function POST(req: NextRequest) {
  const { kind, name, durationDays } = await req.json();
  const n = String(name ?? "").trim();
  if (!n) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  try {
    let row;
    if (kind === "brand") row = await prisma.brand.upsert({ where: { name: n }, update: {}, create: { name: n } });
    else if (kind === "category") row = await prisma.category.upsert({ where: { name: n }, update: {}, create: { name: n } });
    else if (kind === "color") row = await prisma.color.upsert({ where: { name: n }, update: {}, create: { name: n } });
    else if (kind === "size") row = await prisma.size.upsert({ where: { name: n }, update: {}, create: { name: n } });
    else if (kind === "unit") row = await prisma.unit.upsert({ where: { name: n }, update: {}, create: { name: n } });
    else if (kind === "warranty")
      row = await prisma.warrantyPolicy.upsert({
        where: { name: n }, update: {},
        create: { name: n, durationDays: Number(durationDays) || 365 },
      });
    else return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed." }, { status: 400 });
  }
}

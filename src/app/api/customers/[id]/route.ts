import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FIELDS = ["name", "phone", "altPhone", "email", "address", "familyName", "familyPhone",
  "referenceName", "referencePhone", "referenceRelation", "profession", "designation", "organization"] as const;

function clean(body: Record<string, unknown>) {
  const data: Record<string, string | null> = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined) data[f] = String(body[f] ?? "").trim() || null;
  }
  return data;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      sales: {
        include: { items: { include: { variant: { include: { product: true } } } }, payments: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const totalPurchase = customer.sales.reduce((s, x) => s + Number(x.grandTotal), 0);
  const totalDue = Number(customer.openingDue) + customer.sales.reduce((s, x) => s + Number(x.dueTotal), 0);
  return NextResponse.json({ ...customer, totalPurchase, totalDue });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = clean(await req.json());
  if ("name" in data && !data.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  try {
    const customer = await prisma.customer.update({ where: { id }, data });
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "That phone number is already used by another customer." }, { status: 400 });
  }
}

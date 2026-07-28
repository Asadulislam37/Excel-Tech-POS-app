import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FIELDS = ["name", "phone", "altPhone", "email", "address", "familyName", "familyPhone",
  "referenceName", "referencePhone", "referenceRelation", "profession", "designation", "organization"] as const;

function clean(body: Record<string, unknown>) {
  const data: Record<string, string | undefined> = {};
  for (const f of FIELDS) {
    const v = body[f];
    if (v !== undefined) data[f] = String(v ?? "").trim() || undefined;
  }
  return data;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const customers = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { organization: { contains: q, mode: "insensitive" } }] }
      : {},
    include: { sales: { select: { dueTotal: true, grandTotal: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const shaped = customers.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, address: c.address, imageUrl: c.imageUrl,
    profession: c.profession, organization: c.organization,
    referenceName: c.referenceName, referencePhone: c.referencePhone,
    rewardPoints: c.rewardPoints, createdAt: c.createdAt,
    totalPurchase: c.sales.reduce((s, x) => s + Number(x.grandTotal), 0),
    totalDue: Number(c.openingDue) + c.sales.reduce((s, x) => s + Number(x.dueTotal), 0),
  }));
  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = clean(body);
  if (!data.name || !data.phone) return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
  const exists = await prisma.customer.findUnique({ where: { phone: data.phone } });
  if (exists) return NextResponse.json({ error: "A customer with this phone already exists." }, { status: 409 });
  const customer = await prisma.customer.create({ data: { ...data, name: data.name, phone: data.phone } });
  return NextResponse.json(customer, { status: 201 });
}

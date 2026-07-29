import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOnlineOrder, OrderError, type CreateOnlineOrderInput } from "@/lib/online-order";

export const dynamic = "force-dynamic";

// GET — admin: list online orders
export async function GET() {
  const orders = await prisma.onlineOrder.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(orders);
}

// POST — public checkout: create a pending order.
// Validation + DB-sourced pricing live in src/lib/online-order.ts so the web
// checkout and the AI agent create orders through one shared implementation.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateOnlineOrderInput;
  try {
    const order = await createOnlineOrder(body);
    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    if (e instanceof OrderError)
      return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

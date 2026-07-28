import { NextRequest, NextResponse } from "next/server";
import { getDeliveryCharges, saveDeliveryCharges } from "@/lib/settings";

export const dynamic = "force-dynamic";

// GET /api/settings → current shop-wide settings
export async function GET() {
  const delivery = await getDeliveryCharges();
  return NextResponse.json({ delivery });
}

// POST /api/settings { delivery: { insideDhaka, outsideDhaka } }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const d = body?.delivery ?? {};
  const insideDhaka = Number(d.insideDhaka);
  const outsideDhaka = Number(d.outsideDhaka);
  if (!Number.isFinite(insideDhaka) || !Number.isFinite(outsideDhaka) || insideDhaka < 0 || outsideDhaka < 0)
    return NextResponse.json({ error: "Enter valid delivery charges (0 or more)." }, { status: 400 });

  await saveDeliveryCharges({ insideDhaka, outsideDhaka });
  return NextResponse.json({ delivery: await getDeliveryCharges() });
}

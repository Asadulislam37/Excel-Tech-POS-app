import { NextRequest, NextResponse } from "next/server";
import {
  getDeliveryCharges,
  saveDeliveryCharges,
  getPreorderEnabled,
  savePreorderEnabled,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

// GET /api/settings → current shop-wide settings
export async function GET() {
  const [delivery, preorder] = await Promise.all([getDeliveryCharges(), getPreorderEnabled()]);
  return NextResponse.json({ delivery, preorder });
}

// POST /api/settings — updates whichever keys are present:
//   { delivery: { insideDhaka, outsideDhaka } }  and/or  { preorder: boolean }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body?.delivery) {
    const insideDhaka = Number(body.delivery.insideDhaka);
    const outsideDhaka = Number(body.delivery.outsideDhaka);
    if (!Number.isFinite(insideDhaka) || !Number.isFinite(outsideDhaka) || insideDhaka < 0 || outsideDhaka < 0)
      return NextResponse.json({ error: "Enter valid delivery charges (0 or more)." }, { status: 400 });
    await saveDeliveryCharges({ insideDhaka, outsideDhaka });
  }

  if (typeof body?.preorder === "boolean") {
    await savePreorderEnabled(body.preorder);
  }

  const [delivery, preorder] = await Promise.all([getDeliveryCharges(), getPreorderEnabled()]);
  return NextResponse.json({ delivery, preorder });
}

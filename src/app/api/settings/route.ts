import { NextRequest, NextResponse } from "next/server";
import {
  getDeliveryCharges,
  saveDeliveryCharges,
  getPreorderEnabled,
  savePreorderEnabled,
} from "@/lib/settings";
import { getSourcingSettings, saveSourcingSettings, type SourcingSettings } from "@/lib/sourcing";

export const dynamic = "force-dynamic";

// GET /api/settings → current shop-wide settings
export async function GET() {
  const [delivery, preorder, sourcing] = await Promise.all([
    getDeliveryCharges(),
    getPreorderEnabled(),
    getSourcingSettings(),
  ]);
  return NextResponse.json({ delivery, preorder, sourcing });
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

  if (body?.sourcing) {
    const s = body.sourcing as Partial<SourcingSettings>;
    const nums = [s.rate, s.shipping, s.profit, s.round].map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0))
      return NextResponse.json({ error: "Enter valid sourcing numbers (0 or more)." }, { status: 400 });
    await saveSourcingSettings({
      rate: Number(s.rate),
      shipping: Number(s.shipping),
      profit: Number(s.profit),
      round: Math.max(1, Number(s.round)),
    });
  }

  const [delivery, preorder, sourcing] = await Promise.all([
    getDeliveryCharges(),
    getPreorderEnabled(),
    getSourcingSettings(),
  ]);
  return NextResponse.json({ delivery, preorder, sourcing });
}

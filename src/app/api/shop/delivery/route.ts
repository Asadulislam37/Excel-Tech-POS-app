import { NextResponse } from "next/server";
import { getDeliveryCharges } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Public: the storefront checkout reads the shop-wide delivery charges from here.
export async function GET() {
  const delivery = await getDeliveryCharges();
  return NextResponse.json({ delivery });
}

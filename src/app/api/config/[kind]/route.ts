import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Every configuration list behaves the same way; only the fields differ.
const KINDS = {
  brand: { model: "brand", fields: ["name"] },
  category: { model: "category", fields: ["name"] },
  color: { model: "color", fields: ["name", "hex"] },
  size: { model: "size", fields: ["name"] },
  unit: { model: "unit", fields: ["name"] },
  warranty: { model: "warrantyPolicy", fields: ["name", "durationDays", "description"] },
  supplier: { model: "supplier", fields: ["name", "phone", "address", "openingDue"] },
  outlet: { model: "outlet", fields: ["name", "address", "phone", "isDefault"] },
} as const;

type Kind = keyof typeof KINDS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delegate = (kind: Kind) => (prisma as any)[KINDS[kind].model];

const NUMERIC = new Set(["durationDays", "openingDue"]);
const BOOLEAN = new Set(["isDefault"]);

function clean(kind: Kind, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const f of KINDS[kind].fields) {
    if (body[f] === undefined) continue;
    const v = body[f];
    if (NUMERIC.has(f)) data[f] = Number(v) || 0;
    else if (BOOLEAN.has(f)) data[f] = Boolean(v);
    else data[f] = String(v ?? "").trim() || null;
  }
  return data;
}

const bad = (kind: string) => NextResponse.json({ error: `Unknown config type "${kind}".` }, { status: 400 });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!(kind in KINDS)) return bad(kind);
  const rows = await delegate(kind as Kind).findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!(kind in KINDS)) return bad(kind);
  const body = await req.json();
  const data = clean(kind as Kind, body);
  if (!data.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (kind === "warranty" && !data.durationDays) data.durationDays = 365;

  try {
    if (kind === "outlet" && data.isDefault) {
      await prisma.outlet.updateMany({ data: { isDefault: false } });
    }
    const row = await delegate(kind as Kind).create({ data });
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: `"${data.name}" already exists.` }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!(kind in KINDS)) return bad(kind);
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const data = clean(kind as Kind, body);
  if ("name" in data && !data.name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });

  try {
    if (kind === "outlet" && data.isDefault) {
      await prisma.outlet.updateMany({ data: { isDefault: false } });
    }
    const row = await delegate(kind as Kind).update({ where: { id }, data });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "That name is already taken." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!(kind in KINDS)) return bad(kind);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  try {
    await delegate(kind as Kind).delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    // Almost always a foreign-key constraint — the entry is still referenced.
    return NextResponse.json(
      { error: "Can't delete — this is still used by products or transactions." },
      { status: 400 }
    );
  }
}

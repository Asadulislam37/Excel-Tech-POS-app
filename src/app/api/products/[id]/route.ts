import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/products/:id — three body shapes:
//   { action: "ACTIVATE" | "DEACTIVATE" | "PUBLISH" | "UNPUBLISH" }
//   { quickEdit: { variantId, name, costPrice, wholesalePrice, salePrice, mrp, stockIn, stockOut } }
//   { name?, brandId?, categoryId?, unitId?, warrantyPolicyId?, variants?: [{ id, sku, costPrice, wholesalePrice, salePrice, mrp, colorId, sizeId, reorderLevel }] }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();

  try {
    if (body.action) {
      const data =
        body.action === "ACTIVATE" ? { isActive: true } :
        body.action === "DEACTIVATE" ? { isActive: false } :
        body.action === "PUBLISH" ? { isPublished: true } :
        body.action === "UNPUBLISH" ? { isPublished: false } : null;
      if (!data) throw new Error("Unknown action.");
      const product = await prisma.product.update({ where: { id }, data });
      return NextResponse.json(product);
    }

    if (body.quickEdit) {
      const { variantId, name, costPrice, wholesalePrice, salePrice, mrp, stockIn, stockOut } = body.quickEdit;
      await prisma.$transaction(async (tx) => {
        if (name !== undefined) {
          if (!String(name).trim()) throw new Error("Product name cannot be empty.");
          await tx.product.update({ where: { id }, data: { name: String(name).trim() } });
        }
        await tx.productVariant.update({
          where: { id: variantId, productId: id },
          data: {
            costPrice: Number(costPrice) || 0,
            wholesalePrice: Number(wholesalePrice) || null,
            salePrice: Number(salePrice) || 0,
            mrp: Number(mrp) || null,
          },
        });

        const inQty = Math.max(0, Math.trunc(Number(stockIn) || 0));
        const outQty = Math.max(0, Math.trunc(Number(stockOut) || 0));
        if (inQty || outQty) {
          const variant = await tx.productVariant.findUniqueOrThrow({
            where: { id: variantId }, include: { product: true },
          });
          if (variant.product.type === "SERIALIZED")
            throw new Error("IMEI-tracked product — add stock via Serial Number Manage or Purchase so each IMEI is recorded.");
          const outlet =
            (await tx.outlet.findFirst({ where: { isDefault: true } })) ?? (await tx.outlet.findFirst());
          if (!outlet) throw new Error("No outlet configured.");
          const stock = await tx.stockLevel.upsert({
            where: { variantId_outletId: { variantId, outletId: outlet.id } },
            create: { variantId, outletId: outlet.id, quantity: 0 },
            update: {},
          });
          const delta = inQty - outQty;
          const newQty = stock.quantity + delta;
          if (newQty < 0) throw new Error(`Only ${stock.quantity} in stock — cannot stock out ${outQty}.`);
          await tx.stockLevel.update({ where: { id: stock.id }, data: { quantity: newQty } });
          await tx.stockLedger.create({
            data: {
              variantId, outletId: outlet.id, reason: "ADJUSTMENT",
              quantity: delta, balance: newQty, refType: "QuickEdit",
            },
          });
        }
      });
      return NextResponse.json({ ok: true });
    }

    const { name, brandId, categoryId, unitId, warrantyPolicyId, variants } = body;
    if (name !== undefined && !String(name).trim()) throw new Error("Product name cannot be empty.");

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(brandId !== undefined && { brandId: brandId || null }),
          ...(categoryId !== undefined && { categoryId: categoryId || null }),
          ...(unitId !== undefined && { unitId: unitId || null }),
          ...(warrantyPolicyId !== undefined && { warrantyPolicyId: warrantyPolicyId || null }),
        },
      });
      for (const v of variants ?? []) {
        if (!v.id) continue;
        if (!String(v.sku ?? "").trim()) throw new Error("SKU cannot be empty.");
        await tx.productVariant.update({
          where: { id: v.id, productId: id },
          data: {
            sku: String(v.sku).trim(),
            costPrice: Number(v.costPrice) || 0,
            wholesalePrice: Number(v.wholesalePrice) || null,
            salePrice: Number(v.salePrice) || 0,
            mrp: Number(v.mrp) || null,
            colorId: v.colorId || null,
            sizeId: v.sizeId || null,
            ...(v.reorderLevel !== undefined && { reorderLevel: Math.max(0, Math.trunc(Number(v.reorderLevel) || 0)) }),
          },
        });
      }
      return updated;
    });
    return NextResponse.json(product);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed." }, { status: 400 });
  }
}

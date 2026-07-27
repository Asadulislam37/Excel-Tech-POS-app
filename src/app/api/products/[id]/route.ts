import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/products/:id
//   { action: "ACTIVATE" | "DEACTIVATE" | "PUBLISH" | "UNPUBLISH" }
//   or { name?, brandId?, categoryId?, warrantyPolicyId?, variants?: [{ id, sku, costPrice, salePrice, mrp, colorId, sizeId }] }
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

    const { name, brandId, categoryId, warrantyPolicyId, variants } = body;
    if (name !== undefined && !String(name).trim()) throw new Error("Product name cannot be empty.");

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(brandId !== undefined && { brandId: brandId || null }),
          ...(categoryId !== undefined && { categoryId: categoryId || null }),
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
            costPrice: v.costPrice,
            salePrice: v.salePrice,
            mrp: v.mrp || null,
            colorId: v.colorId || null,
            sizeId: v.sizeId || null,
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

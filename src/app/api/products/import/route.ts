import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ImportRow = {
  name?: string; type?: string; brand?: string; category?: string; warranty?: string;
  sku?: string; cost?: number; wholesale?: number; retail?: number; mrp?: number;
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const isSerialized = (t?: string) => /phone|serial|imei/i.test(String(t ?? ""));

// POST /api/products/import  { rows: ImportRow[] }
// Upserts products by SKU: existing SKU → update, new/blank SKU → create.
export async function POST(req: NextRequest) {
  const { rows } = (await req.json()) as { rows: ImportRow[] };
  if (!Array.isArray(rows) || !rows.length)
    return NextResponse.json({ error: "The file has no rows." }, { status: 400 });
  if (rows.length > 5000)
    return NextResponse.json({ error: "Too many rows (max 5000). Split the file." }, { status: 400 });

  // Upsert the referenced brands / categories / warranties once.
  const brandId: Record<string, string> = {};
  const catId: Record<string, string> = {};
  const warrId: Record<string, string> = {};
  for (const name of [...new Set(rows.map((r) => r.brand?.trim()).filter(Boolean) as string[])])
    brandId[name] = (await prisma.brand.upsert({ where: { name }, update: {}, create: { name } })).id;
  for (const name of [...new Set(rows.map((r) => r.category?.trim()).filter(Boolean) as string[])])
    catId[name] = (await prisma.category.upsert({ where: { name }, update: {}, create: { name } })).id;
  for (const name of [...new Set(rows.map((r) => r.warranty?.trim()).filter(Boolean) as string[])])
    warrId[name] = (await prisma.warrantyPolicy.upsert({ where: { name }, update: {}, create: { name, durationDays: 365 } })).id;

  // Prepare auto-SKU generation for rows without a SKU.
  const existingSkus = new Set((await prisma.productVariant.findMany({ select: { sku: true } })).map((v) => v.sku));
  let maxAuto = 999;
  for (const s of existingSkus) { const m = /^ET(\d+)$/.exec(s); if (m) maxAuto = Math.max(maxAuto, Number(m[1])); }
  const nextSku = () => { let n = maxAuto + 1; while (existingSkus.has(`ET${n}`)) n++; maxAuto = n; const s = `ET${n}`; existingSkus.add(s); return s; };

  let created = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = r.name?.trim();
    const sku = r.sku?.trim();
    const cost = num(r.cost ?? r.wholesale);
    const retail = num(r.retail) || num(r.mrp);
    const wholesale = num(r.wholesale) || undefined;
    const mrp = num(r.mrp) || undefined;

    try {
      const existing = sku ? await prisma.productVariant.findUnique({ where: { sku }, select: { id: true, productId: true } }) : null;
      if (existing) {
        // Update prices on the variant + the product's classification.
        await prisma.$transaction([
          prisma.productVariant.update({
            where: { id: existing.id },
            data: { costPrice: cost, salePrice: retail || 0, wholesalePrice: wholesale ?? null, mrp: mrp ?? null },
          }),
          prisma.product.update({
            where: { id: existing.productId },
            data: {
              ...(name && { name }),
              ...(r.brand?.trim() && { brandId: brandId[r.brand.trim()] }),
              ...(r.category?.trim() && { categoryId: catId[r.category.trim()] }),
              ...(r.warranty?.trim() && { warrantyPolicyId: warrId[r.warranty.trim()] }),
            },
          }),
        ]);
        updated++;
        continue;
      }

      if (!name) { skipped++; errors.push(`Row ${i + 2}: no product name — skipped.`); continue; }
      const finalSku = sku || nextSku();
      await prisma.product.create({
        data: {
          name,
          slug: `${slugify(name).slice(0, 60)}-${slugify(finalSku)}-${Date.now().toString(36)}`,
          type: isSerialized(r.type ?? r.category) ? "SERIALIZED" : "STANDARD",
          brandId: r.brand?.trim() ? brandId[r.brand.trim()] : undefined,
          categoryId: r.category?.trim() ? catId[r.category.trim()] : undefined,
          warrantyPolicyId: r.warranty?.trim() ? warrId[r.warranty.trim()] : undefined,
          variants: { create: { sku: finalSku, costPrice: cost, salePrice: retail || 0, wholesalePrice: wholesale, mrp } },
        },
      });
      created++;
    } catch (e) {
      skipped++;
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : "failed"}.`);
    }
  }

  return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 20), totalErrors: errors.length });
}

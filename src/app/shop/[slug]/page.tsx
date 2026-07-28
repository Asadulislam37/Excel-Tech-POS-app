"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { taka } from "@/lib/format";
import { addToCart } from "@/lib/cart";
import { ShieldCheck, ShoppingBag, Check } from "lucide-react";

type Variant = {
  id: string; salePrice: string; onlinePrice?: string | null; sku: string;
  color?: { name: string; hex?: string | null } | null; size?: { name: string } | null;
  stockLevels: { quantity: number }[]; _count: { serialUnits: number };
};
type Product = {
  id: string; name: string; slug: string; type: string; description?: string | null;
  brand?: { name: string } | null; warrantyPolicy?: { name: string } | null;
  variants: Variant[];
};

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [p, setP] = useState<Product | null>(null);
  const [sel, setSel] = useState<Variant | null>(null);
  const [added, setAdded] = useState(false);
  const [delivery, setDelivery] = useState({ insideDhaka: 80, outsideDhaka: 120 });

  useEffect(() => {
    fetch(`/api/shop/products?slug=${encodeURIComponent(slug)}`).then(async (r) => {
      if (r.ok) { const d = await r.json(); setP(d); setSel(d.variants[0] ?? null); }
    });
  }, [slug]);

  useEffect(() => {
    fetch("/api/shop/delivery").then(async (r) => { if (r.ok) setDelivery((await r.json()).delivery); });
  }, []);

  if (!p) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  const stockOf = (v: Variant) => (p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0));
  const price = sel ? Number(sel.onlinePrice ?? sel.salePrice) : 0;

  const add = () => {
    if (!sel) return;
    addToCart({
      variantId: sel.id, slug: p.slug, name: p.name,
      variant: [sel.color?.name, sel.size?.name].filter(Boolean).join(" · "),
      unitPrice: price,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card flex h-80 items-center justify-center bg-gradient-to-br from-tealsoft to-paper text-7xl font-bold text-tealdark">
        {p.brand?.name?.[0] ?? p.name[0]}
      </div>
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">{p.brand?.name}</div>
        <h1 className="mt-1 text-2xl font-bold">{p.name}</h1>
        {p.warrantyPolicy && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-tealsoft px-2.5 py-1 text-[12px] font-semibold text-tealdark">
            <ShieldCheck size={13} /> {p.warrantyPolicy.name} warranty
          </div>
        )}
        <div className="mt-4 text-3xl font-bold text-tealdark">{taka(price)}</div>

        {p.variants.length > 1 && (
          <div className="mt-5">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Choose variant</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.variants.map((v) => {
                const label = [v.color?.name, v.size?.name].filter(Boolean).join(" · ") || v.sku;
                const out = stockOf(v) === 0;
                return (
                  <button key={v.id} disabled={out} onClick={() => setSel(v)}
                    className={`rounded-lg border px-3.5 py-2 text-[13px] font-semibold disabled:opacity-40 ${sel?.id === v.id ? "border-teal bg-tealsoft text-tealdark" : "border-line bg-card"}`}>
                    {label}{out && " · out"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button className="btn btn-primary flex-1 py-3" disabled={!sel || stockOf(sel) === 0} onClick={add}>
            {added ? <><Check size={16} /> Added</> : <><ShoppingBag size={16} /> Add to cart</>}
          </button>
          <button className="btn btn-ghost flex-1 py-3" disabled={!sel || stockOf(sel) === 0} onClick={() => { add(); router.push("/shop/checkout"); }}>
            Buy now
          </button>
        </div>

        {sel && stockOf(sel) > 0 && stockOf(sel) <= 3 && (
          <div className="mt-3 text-[12px] font-semibold text-amber">Only {stockOf(sel)} left in stock</div>
        )}
        {p.description && <p className="mt-5 text-[14px] leading-relaxed text-body">{p.description}</p>}
        <div className="mt-5 rounded-lg bg-card p-4 text-[13px] text-muted">
          Cash on delivery available · Inside Dhaka {taka(delivery.insideDhaka)}, outside {taka(delivery.outsideDhaka)} · Visit our shop at Shyamoli Square for EMI purchase
        </div>
      </div>
    </div>
  );
}

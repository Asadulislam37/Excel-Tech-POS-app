"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { taka } from "@/lib/format";
import { Search } from "lucide-react";

type Product = {
  id: string; name: string; slug: string; type: string;
  brand?: { name: string } | null;
  variants: { id: string; salePrice: string; onlinePrice?: string | null;
    stockLevels: { quantity: number }[]; _count: { serialUnits: number } }[];
};

export default function ShopHome() {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/shop/products?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand)}`);
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products); setBrands(data.brands);
    }
  }, [q, brand]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const priceOf = (p: Product) => {
    const prices = p.variants.map((v) => Number(v.onlinePrice ?? v.salePrice));
    return prices.length ? Math.min(...prices) : 0;
  };
  const stockOf = (p: Product) =>
    p.variants.reduce((s, v) => s + (p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0)), 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-ink px-6 py-8 text-white">
        <h1 className="text-2xl font-bold">Latest phones & accessories</h1>
        <p className="mt-1 text-[13px] text-slate-300">Official warranty · EMI available in store · Delivery all over Bangladesh</p>
        <div className="relative mt-4 max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-muted" />
          <input className="input pl-9" placeholder="Search phone or brand…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setBrand("")} className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${!brand ? "bg-teal text-white" : "bg-card border border-line"}`}>All</button>
        {brands.map((b) => (
          <button key={b.id} onClick={() => setBrand(b.name)} className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${brand === b.name ? "bg-teal text-white" : "bg-card border border-line"}`}>{b.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => {
          const stock = stockOf(p);
          return (
            <Link key={p.id} href={`/shop/${p.slug}`} className="card overflow-hidden transition-shadow hover:shadow-md">
              <div className="flex h-36 items-center justify-center bg-gradient-to-br from-tealsoft to-paper text-3xl font-bold text-tealdark">
                {p.brand?.name?.[0] ?? p.name[0]}
              </div>
              <div className="p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{p.brand?.name}</div>
                <div className="mt-0.5 text-[13px] font-semibold leading-snug">{p.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="font-bold text-tealdark">{taka(priceOf(p))}</div>
                  {stock === 0 && <span className="rounded bg-redsoft px-1.5 py-0.5 text-[10px] font-bold text-red">Stock out</span>}
                </div>
              </div>
            </Link>
          );
        })}
        {products.length === 0 && (
          <div className="col-span-full py-16 text-center text-sm text-muted">No products match your search.</div>
        )}
      </div>
    </div>
  );
}

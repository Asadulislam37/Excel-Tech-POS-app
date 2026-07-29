"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Store } from "lucide-react";
import { cartCount } from "@/lib/cart";
import ShopChatWidget from "@/components/ShopChatWidget";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(cartCount());
    update();
    window.addEventListener("cart-changed", update);
    return () => window.removeEventListener("cart-changed", update);
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/shop" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal">
              <Store size={18} className="text-white" />
            </div>
            <div>
              <div className="text-[15px] font-bold leading-tight">Excel Tech</div>
              <div className="text-[11px] text-muted">Shyamoli Square, Dhaka</div>
            </div>
          </Link>
          <Link href="/shop/checkout" className="relative ml-auto flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold hover:bg-paper">
            <ShoppingBag size={16} />
            Cart
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal px-1 text-[11px] font-bold text-white">{count}</span>
            )}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mt-10 border-t border-line bg-card py-8 text-center text-[12px] text-muted">
        Excel Tech · Shyamoli Square Shopping Mall, Dhaka · All phones come with official warranty
      </footer>
      <ShopChatWidget />
    </div>
  );
}

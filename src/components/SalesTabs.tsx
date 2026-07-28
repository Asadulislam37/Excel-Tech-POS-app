"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SalesTabs() {
  const path = usePathname();
  const tabs = [
    { label: "Place Order", href: "/sales/pos" },
    { label: "Sold History", href: "/sales/history" },
    { label: "Sold Products", href: "/sales/products" },
  ];
  return (
    <div className="inline-flex rounded-full border border-line bg-card p-1">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href}
          className={`rounded-full px-5 py-2 text-[13px] font-bold transition-colors ${path === t.href ? "bg-ink text-white" : "text-body hover:bg-paper"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

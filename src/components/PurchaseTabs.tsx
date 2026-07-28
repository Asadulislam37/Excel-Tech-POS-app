"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PurchaseTabs() {
  const path = usePathname();
  const tabs = [
    { label: "Purchase", href: "/purchase" },
    { label: "Purchase History", href: "/purchase/history" },
    { label: "Purchase Products", href: "/purchase/products" },
  ];
  return <Tabs tabs={tabs} path={path} />;
}

export function PurchaseReturnTabs() {
  const path = usePathname();
  const tabs = [
    { label: "Purchase Return", href: "/purchase/return" },
    { label: "Return History", href: "/purchase/return/history" },
    { label: "Return Products", href: "/purchase/return/products" },
  ];
  return <Tabs tabs={tabs} path={path} />;
}

function Tabs({ tabs, path }: { tabs: { label: string; href: string }[]; path: string }) {
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

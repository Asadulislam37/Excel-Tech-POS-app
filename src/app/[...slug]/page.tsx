import Link from "next/link";
import { NAV, NavGroup } from "@/lib/nav";

export default async function Placeholder({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const href = "/" + slug.join("/");
  let label = "This module";
  let phase: number | undefined;
  for (const item of NAV) {
    const children = (item as NavGroup).children;
    if (children) {
      const leaf = children.find((c) => c.href === href);
      if (leaf) { label = leaf.label; phase = leaf.phase; }
    }
  }
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="card p-8">
        <div className="text-4xl">🛠️</div>
        <h1 className="mt-3 text-lg font-bold">{label}</h1>
        <p className="mt-1 text-[13px] text-muted">
          The database schema for this module is already in place.
          {phase ? ` The screen is planned for Phase ${phase} of the PulsePOS roadmap.` : " The screen is coming in a later phase."}
        </p>
        <Link href="/sales/pos" className="btn btn-primary mt-5 inline-flex">Back to POS</Link>
      </div>
    </div>
  );
}

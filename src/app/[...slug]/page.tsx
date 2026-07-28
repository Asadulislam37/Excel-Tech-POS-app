import Link from "next/link";
import { NAV, NavNode, isGroup } from "@/lib/nav";

/** Find a leaf anywhere in the (now nested) nav tree. */
function findLeaf(nodes: NavNode[], href: string): NavNode | undefined {
  for (const n of nodes) {
    if (isGroup(n)) {
      const hit = findLeaf(n.children, href);
      if (hit) return hit;
    } else if (n.href === href) return n;
  }
}

export default async function Placeholder({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const href = "/" + slug.join("/");
  const leaf = findLeaf(NAV as NavNode[], href);
  const label = leaf && !isGroup(leaf) ? leaf.label : "This module";
  const phase = leaf && !isGroup(leaf) ? leaf.phase : undefined;

  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="card p-8">
        <div className="text-4xl">🛠️</div>
        <h1 className="mt-3 text-lg font-bold">{label}</h1>
        <p className="mt-1 text-[13px] text-muted">
          The database schema for this module is already in place.
          {phase ? ` The screen is planned for Phase ${phase}.` : " The screen is coming in a later phase."}
        </p>
        <Link href="/sales/pos" className="btn btn-primary mt-5 inline-flex">Back to POS</Link>
      </div>
    </div>
  );
}

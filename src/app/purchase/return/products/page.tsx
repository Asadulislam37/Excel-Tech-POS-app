import ProductsReport from "@/components/ProductsReport";
import { PurchaseReturnTabs } from "@/components/PurchaseTabs";

export default function Page() {
  return <ProductsReport title="Purchase Return Products" endpoint="/api/purchase-returns/products" amountLabel="Price" tabs={<PurchaseReturnTabs />} />;
}

import ProductsReport from "@/components/ProductsReport";
import { PurchaseTabs } from "@/components/PurchaseTabs";

export default function Page() {
  return <ProductsReport title="Purchase Products" endpoint="/api/purchase/products" amountLabel="Price" tabs={<PurchaseTabs />} />;
}

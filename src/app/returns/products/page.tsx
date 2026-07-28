import ProductsReport from "@/components/ProductsReport";

export default function Page() {
  return <ProductsReport title="Return Products" endpoint="/api/returns/products" amountLabel="Refund" showCondition />;
}

import ProductsReport from "@/components/ProductsReport";

export default function Page() {
  return <ProductsReport title="Exchange Products" endpoint="/api/exchanges/products?direction=OUT" amountLabel="Value" />;
}

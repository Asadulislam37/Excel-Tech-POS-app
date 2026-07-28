import ProductsReport from "@/components/ProductsReport";

export default function Page() {
  return <ProductsReport title="Exchange Return Products" endpoint="/api/exchanges/products?direction=IN" amountLabel="Value" />;
}

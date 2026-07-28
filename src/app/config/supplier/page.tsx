import ConfigCrud from "@/components/ConfigCrud";

export default function Page() {
  return (
    <ConfigCrud
      kind="supplier"
      title="Supplier"
      subtitle="Wholesalers you buy stock from."
      fields={[{ key: "name", label: "Supplier Name", placeholder: "e.g. Motaleb Plaza Wholesale" }, { key: "phone", label: "Phone", placeholder: "01XXXXXXXXX" }, { key: "address", label: "Address", placeholder: "Shop address" }, { key: "openingDue", label: "Opening Due", type: "number", placeholder: "0" }]}
    />
  );
}

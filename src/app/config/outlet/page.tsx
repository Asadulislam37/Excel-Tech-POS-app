import ConfigCrud from "@/components/ConfigCrud";

export default function Page() {
  return (
    <ConfigCrud
      kind="outlet"
      title="Outlet"
      subtitle="Shops and warehouses that hold stock."
      fields={[{ key: "name", label: "Outlet Name", placeholder: "e.g. Excel Tech — Shyamoli" }, { key: "phone", label: "Phone", placeholder: "01XXXXXXXXX" }, { key: "address", label: "Address", placeholder: "Full address" }, { key: "isDefault", label: "Default outlet", type: "checkbox" }]}
    />
  );
}

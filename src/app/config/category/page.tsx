import ConfigCrud from "@/components/ConfigCrud";

export default function Page() {
  return (
    <ConfigCrud
      kind="category"
      title="Category"
      subtitle="Product categories such as Used Device, Screen protector, TWS."
      fields={[{ key: "name", label: "Category Name", placeholder: "e.g. Powerbank" }]}
    />
  );
}

import ConfigCrud from "@/components/ConfigCrud";

export default function Page() {
  return (
    <ConfigCrud
      kind="brand"
      title="Brand"
      subtitle="Phone and accessory brands used across products."
      fields={[{ key: "name", label: "Brand Name", placeholder: "e.g. Samsung" }]}
    />
  );
}

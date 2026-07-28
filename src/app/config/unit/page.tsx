import ConfigCrud from "@/components/ConfigCrud";

export default function Page() {
  return (
    <ConfigCrud
      kind="unit"
      title="Unit"
      subtitle="Units of measure for products."
      fields={[{ key: "name", label: "Unit Name", placeholder: "e.g. Pieces" }]}
    />
  );
}

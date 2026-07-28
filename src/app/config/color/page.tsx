import ConfigCrud from "@/components/ConfigCrud";

export default function Page() {
  return (
    <ConfigCrud
      kind="color"
      title="Color"
      subtitle="Colour options for product variants."
      fields={[{ key: "name", label: "Colour Name", placeholder: "e.g. Titanium" }, { key: "hex", label: "Hex Code", placeholder: "#111111" }]}
    />
  );
}

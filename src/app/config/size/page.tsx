import ConfigCrud from "@/components/ConfigCrud";

export default function Page() {
  return (
    <ConfigCrud
      kind="size"
      title="Size / Storage"
      subtitle="Storage or size options, e.g. 8/256."
      fields={[{ key: "name", label: "Size / Storage", placeholder: "e.g. 12/512" }]}
    />
  );
}

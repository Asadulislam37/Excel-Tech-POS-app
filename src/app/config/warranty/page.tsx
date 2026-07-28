import ConfigCrud from "@/components/ConfigCrud";

export default function Page() {
  return (
    <ConfigCrud
      kind="warranty"
      title="Warranty"
      subtitle="Warranty policies applied to products at sale time."
      fields={[{ key: "name", label: "Policy Name", placeholder: "e.g. 12 Months Official" }, { key: "durationDays", label: "Duration (days)", type: "number", placeholder: "365" }, { key: "description", label: "Description", placeholder: "Optional note" }]}
    />
  );
}

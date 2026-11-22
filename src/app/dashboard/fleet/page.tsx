import { Metadata } from "next";
import { FleetMap } from "./_components/FleetMap";

export const metadata: Metadata = {
  title: "Armada & GPS | TB Masdar Utama",
  description: "Lacak posisi armada secara live di peta",
};

export default function FleetPage() {
  return <FleetMap />;
}

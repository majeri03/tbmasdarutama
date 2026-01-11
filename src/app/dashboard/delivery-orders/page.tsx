import { Metadata } from "next";
import { DeliveryOrderClient } from "./_components/DeliveryOrderClient";

export const metadata: Metadata = {
  title: "Surat Jalan | TB Masdar Utama",
  description: "Kelola surat jalan dan tracking pengiriman",
};

export default function DeliveryOrdersPage() {
  return <DeliveryOrderClient />;
}
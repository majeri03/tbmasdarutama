import { Metadata } from "next";
import { PurchasesClient } from "./_components/PurchasesClient";

export const metadata: Metadata = {
  title: "Purchase Orders | TB Masdar Utama",
  description: "Kelola Purchase Orders dan pembelian barang",
};

export default function PurchasesPage() {
  return <PurchasesClient />;
}
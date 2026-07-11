import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { BulkImportClient } from "./_components/BulkImportClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import Massal Produk | TB Masdar Utama",
  description: "Input produk secara massal dengan voice input atau tabel manual",
};

export default async function BulkImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [categories, subCategories, suppliers, units] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subCategory.findMany({ select: { id: true, name: true, categoryId: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({
      select: { id: true, code: true, name: true },
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-4 md:p-6">
      <BulkImportClient
        categories={categories}
        subCategories={subCategories}
        suppliers={suppliers}
        units={units}
      />
    </div>
  );
}

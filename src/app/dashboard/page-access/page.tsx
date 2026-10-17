import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getPageAccessMatrix } from "@/lib/actions/page-access.actions";
import { redirect } from "next/navigation";
import PageAccessClient from "./_components/PageAccessClient";

export const metadata: Metadata = {
  title: "Kelola Akses Halaman | Dashboard",
};

export default async function PageAccessPage() {
  const currentUser = await getCurrentUser();
  const normalizedRole = (currentUser?.role || "").toUpperCase().replace(/[\s-]+/g, "_");

  if (!currentUser || normalizedRole !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const result = await getPageAccessMatrix();
  const matrix = result.success && result.data ? result.data : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🛡️ Kelola Akses & Visibilitas Halaman</h1>
          <p className="text-sm text-gray-500">Atur visibilitas halaman bagi Admin dan Kasir (Super Admin Only)</p>
        </div>
      </div>

      <PageAccessClient initialMatrix={matrix as any} />
    </div>
  );
}



import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/utils/role";
import { getStorageOverview, listR2Files } from "@/lib/actions/storage.actions";
import { StorageClient } from "./_components/StorageClient";

export const metadata: Metadata = {
  title: "Penyimpanan Gambar | TB Masdar Utama",
  description: "Kelola file gambar Cloudflare R2: kuota, daftar file, yatim, dan rekonsiliasi",
};

interface StoragePageProps {
  searchParams: {
    status?: string;
    folder?: string;
    search?: string;
    page?: string;
  };
}

export default async function StoragePage({ searchParams }: StoragePageProps) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!hasPermission(session, "VIEW_MENU_SETTINGS")) {
    redirect("/dashboard");
  }

  const status = params.status || "";
  const folder = params.folder || "";
  const search = params.search || "";
  const page = parseInt(params.page || "1");

  const [overviewResult, listResult] = await Promise.all([
    getStorageOverview(),
    listR2Files({ status: status || undefined, folder: folder || undefined, search: search || undefined, page, limit: 30 }),
  ]);

  if (!overviewResult.success) {
    return (
      <div className="p-6">
        <div className="glass-card p-8 text-center">
          <p className="text-red-600 font-semibold">
            {overviewResult.error || "Gagal memuat data penyimpanan"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <StorageClient
      overview={overviewResult.data}
      files={listResult.success ? listResult.data ?? [] : []}
      pagination={listResult.success ? listResult.pagination ?? { page: 1, limit: 30, total: 0, totalPages: 1 } : { page: 1, limit: 30, total: 0, totalPages: 1 }}
      filters={{ status, folder, search }}
    />
  );
}

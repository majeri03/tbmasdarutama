import { Metadata } from "next";
import { getUsers } from "@/lib/actions/user.actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import UsersClient from "./_components/UsersClient";

export const metadata: Metadata = {
  title: "Manajemen User | Dashboard",
};

export default async function UsersPage() {
  // 1. Cek Auth di Server Side
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  // 2. Fetch Data
  const result = await getUsers();
  // Pastikan users adalah array kosong jika data tidak ada
  const users = result.success && result.data ? result.data : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manajemen Akun</h1>
          <p className="text-sm text-gray-500">Kelola akses pengguna sistem (Super Admin Only)</p>
        </div>
      </div>

      <UsersClient initialUsers={users} />
    </div>
  );
}
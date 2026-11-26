import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import CashClient from "./_components/CashClient";

// FIX (25 Nov 2026, batch 8 item 233): halaman Kas BELUM PERNAH ADA.
// Route API /api/cash-movements (GET daftar + POST catat) sudah ada dan
// data kas ada (13 record di Manajemen Data), tapi TIDAK ADA satu pun UI
// yang memakainya — tidak ada halaman, tidak ada item menu, tidak ada
// tombol Kas Masuk/Keluar di mana pun. Halaman ini + item menu "Kas" di
// sidebar adalah UI-nya: memakai API yang sudah ada, tanpa mengubah API.
//
// Akses: ADMIN+ (sama dengan gate di /api/cash-movements — KASIR
// mendapat 403 dari API). Menu sidebar memakai permission VIEW_REPORTS
// (SUPER_ADMIN + ADMIN) supaya konsisten dengan gate tersebut.
export default async function CashPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kas</h1>
          <p className="page-subtitle">Arus kas masuk dan keluar toko</p>
        </div>
        <div className="glass-card p-6 text-center">
          <p className="text-gray-600">
            Halaman Kas hanya untuk ADMIN dan SUPER_ADMIN.
          </p>
          <Link
            href="/dashboard"
            className="inline-block mt-4 px-5 py-2.5 bg-red-900 hover:bg-red-800 text-white font-semibold rounded-lg transition shadow"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kas</h1>
        <p className="page-subtitle">
          Saldo dan arus kas masuk / keluar toko — termasuk kas masuk otomatis
          dari penjualan
        </p>
      </div>
      <CashClient />
    </div>
  );
}

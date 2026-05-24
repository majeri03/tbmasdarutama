"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Trash2,
  BookOpen,
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";
import {
  getDataStatistics,
  hapusSemuaTransaksiPenjualan,
  tutupBukuTahunan,
} from "@/lib/actions/data-management.actions";

type ModalType = "hapus-transaksi" | "tutup-buku" | null;
type Step = "warning" | "confirm" | "password" | "done";

interface DataStats {
  sales: number;
  purchases: number;
  deliveryOrders: number;
  customerDebts: number;
  supplierDebts: number;
  stockMovements: number;
  cashMovements: number;
  total: number;
}

interface ResultDetail {
  [key: string]: number;
}

export default function DataManagementTab() {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [step, setStep] = useState<Step>("warning");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultDetail, setResultDetail] = useState<ResultDetail | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [tahunTutupBuku, setTahunTutupBuku] = useState(new Date().getFullYear());
  const { toast, showToast, hideToast } = useToast();

  const CONFIRM_KEYWORD_HAPUS = "HAPUS TRANSAKSI";
  const CONFIRM_KEYWORD_TUTUP = `TUTUP BUKU ${tahunTutupBuku}`;

  async function loadStats() {
    setLoadingStats(true);
    const res = await getDataStatistics();
    if (res.success && res.data) setStats(res.data as DataStats);
    setLoadingStats(false);
  }

  useEffect(() => {
    loadStats();
  }, []);

  function openModal(type: ModalType) {
    setActiveModal(type);
    setStep("warning");
    setPassword("");
    setConfirmText("");
    setShowPassword(false);
    setResultDetail(null);
    setResultMessage("");
  }

  function closeModal() {
    if (loading) return;
    setActiveModal(null);
    setStep("warning");
    setPassword("");
    setConfirmText("");
  }

  const confirmKeyword = activeModal === "hapus-transaksi" ? CONFIRM_KEYWORD_HAPUS : CONFIRM_KEYWORD_TUTUP;

  async function handleExecute() {
    if (!password.trim()) {
      showToast("Password wajib diisi", "error");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (activeModal === "hapus-transaksi") {
        res = await hapusSemuaTransaksiPenjualan(password);
      } else {
        res = await tutupBukuTahunan(password, tahunTutupBuku);
      }

      if (res.success) {
        setResultMessage(res.message || "Operasi berhasil");
        setResultDetail(res.detail as ResultDetail || null);
        setStep("done");
        await loadStats();
      } else {
        showToast(res.error || "Operasi gagal", "error");
      }
    } catch {
      showToast("Terjadi kesalahan sistem", "error");
    } finally {
      setLoading(false);
    }
  }

  const statItems = stats
    ? [
        { label: "Penjualan (Sales)", value: stats.sales, icon: "🛒" },
        { label: "Pembelian (PO)", value: stats.purchases, icon: "📦" },
        { label: "Surat Jalan", value: stats.deliveryOrders, icon: "🚚" },
        { label: "Utang Pelanggan", value: stats.customerDebts, icon: "👤" },
        { label: "Utang Supplier", value: stats.supplierDebts, icon: "🏭" },
        { label: "Riwayat Stok", value: stats.stockMovements, icon: "📊" },
        { label: "Kas Masuk/Keluar", value: stats.cashMovements, icon: "💰" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* ── Header Warning ── */}
      <div className="glass-card p-5 border-l-4 border-red-500 bg-red-50/60">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-red-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-red-800 text-base">Zona Berbahaya — Data Management</h3>
            <p className="text-sm text-red-700 mt-1 leading-relaxed">
              Halaman ini berisi operasi yang bersifat <strong>permanen dan tidak dapat dibatalkan</strong>.
              Pastikan Anda telah membuat cadangan data sebelum melanjutkan.
              Setiap operasi memerlukan verifikasi password untuk keamanan.
            </p>
          </div>
        </div>
      </div>

      {/* ── Data Statistics ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">Ringkasan Data Transaksi Saat Ini</h3>
          </div>
          <button
            onClick={loadStats}
            disabled={loadingStats}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStats ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loadingStats ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {statItems.map((item) => (
              <div key={item.label} className="bg-white/70 rounded-xl p-3 border border-gray-100 shadow-sm">
                <div className="text-xl mb-1">{item.icon}</div>
                <div className="text-2xl font-bold text-gray-800">{item.value.toLocaleString("id-ID")}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
              </div>
            ))}
            {stats && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <div className="text-xl mb-1">📋</div>
                <div className="text-2xl font-bold text-red-700">{stats.total.toLocaleString("id-ID")}</div>
                <div className="text-xs text-red-600 mt-0.5">Total Record</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Operation Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Card 1: Hapus Transaksi Penjualan */}
        <div className="glass-card p-5 border border-orange-200 bg-orange-50/30 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Hapus Transaksi Penjualan</h3>
              <p className="text-xs text-orange-700 font-medium mt-0.5">Operasi Berbahaya</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 leading-relaxed space-y-1.5">
            <p>Menghapus <strong>seluruh data penjualan</strong> beserta:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-gray-500">
              <li>Item penjualan POS</li>
              <li>Utang pelanggan & pembayarannya</li>
              <li>Surat jalan terkait</li>
              <li>Riwayat stok tipe SALE</li>
            </ul>
            <p className="text-orange-700 font-medium mt-2">
              ⚠️ Data pembelian, stok produk, dan master data tetap aman.
            </p>
          </div>
          <button
            onClick={() => openModal("hapus-transaksi")}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md"
          >
            <Trash2 className="w-4 h-4" />
            Hapus Transaksi Penjualan
          </button>
        </div>

        {/* Card 2: Tutup Buku Tahunan */}
        <div className="glass-card p-5 border border-red-300 bg-red-50/30 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Tutup Buku Tahunan</h3>
              <p className="text-xs text-red-700 font-medium mt-0.5">⚠️ Operasi SANGAT Berbahaya</p>
            </div>
          </div>
          <div className="text-sm text-gray-600 leading-relaxed space-y-1.5">
            <p>Penutupan buku akhir tahun — menghapus <strong>semua data transaksi</strong>:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-gray-500">
              <li>Penjualan & pembelian lengkap</li>
              <li>Semua utang (pelanggan & supplier)</li>
              <li>Surat jalan & riwayat stok</li>
              <li>Kas masuk/keluar</li>
              <li><strong className="text-red-600">Stok semua produk direset ke 0</strong></li>
            </ul>
            <p className="text-red-700 font-medium mt-2">
              🔴 Data master (produk, user, pelanggan, supplier) tetap aman.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Tahun:</label>
            <select
              value={tahunTutupBuku}
              onChange={(e) => setTahunTutupBuku(Number(e.target.value))}
              className="glass-input py-1.5 text-sm flex-1"
            >
              <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            </select>
          </div>

          <button
            onClick={() => openModal("tutup-buku")}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md"
          >
            <BookOpen className="w-4 h-4" />
            Tutup Buku Tahun {tahunTutupBuku}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL KONFIRMASI
      ══════════════════════════════════════════════════ */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Modal Header */}
            <div className={`px-6 py-4 ${activeModal === "tutup-buku" ? "bg-red-600" : "bg-orange-500"}`}>
              <div className="flex items-center gap-3">
                {activeModal === "tutup-buku"
                  ? <BookOpen className="w-6 h-6 text-white" />
                  : <Trash2 className="w-6 h-6 text-white" />
                }
                <div>
                  <h3 className="font-bold text-white text-lg">
                    {activeModal === "tutup-buku" ? `Tutup Buku Tahun ${tahunTutupBuku}` : "Hapus Transaksi Penjualan"}
                  </h3>
                  <p className="text-white/80 text-xs">
                    {step === "warning" && "Langkah 1 dari 3 — Baca peringatan"}
                    {step === "confirm" && "Langkah 2 dari 3 — Konfirmasi ketik ulang"}
                    {step === "password" && "Langkah 3 dari 3 — Verifikasi password"}
                    {step === "done" && "Selesai"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">

              {/* STEP 1: Warning */}
              {step === "warning" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-yellow-800 leading-relaxed">
                      {activeModal === "hapus-transaksi" ? (
                        <>
                          <p className="font-semibold mb-1">Yang akan dihapus secara PERMANEN:</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            <li>Semua data penjualan POS</li>
                            <li>Utang pelanggan & riwayat pembayaran</li>
                            <li>Surat jalan (delivery orders)</li>
                            <li>Riwayat stok penjualan</li>
                          </ul>
                          <p className="mt-2 font-medium">Stok produk <u>tidak</u> direset otomatis.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold mb-1">TUTUP BUKU — Efek Tahun {tahunTutupBuku}:</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            <li>SEMUA penjualan & pembelian dihapus</li>
                            <li>Semua utang & pembayaran dihapus</li>
                            <li>Riwayat stok & kas dihapus</li>
                            <li className="font-semibold text-red-700">Stok SEMUA produk direset ke 0</li>
                          </ul>
                          <p className="mt-2 font-medium">Ini adalah operasi penutupan tahun buku. Pastikan sudah ada backup!</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={closeModal} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">
                      Batal
                    </button>
                    <button
                      onClick={() => setStep("confirm")}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all ${activeModal === "tutup-buku" ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"}`}
                    >
                      Saya Mengerti, Lanjutkan →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Confirm by typing */}
              {step === "confirm" && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <p>Untuk memastikan ini bukan klik tidak sengaja, ketik kalimat berikut persis:</p>
                    <p className="mt-2 font-mono font-bold text-lg text-center py-3 bg-gray-100 rounded-xl tracking-wide">
                      {confirmKeyword}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="glass-input w-full font-mono"
                    placeholder={`Ketik: ${confirmKeyword}`}
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setStep("warning")} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">
                      ← Kembali
                    </button>
                    <button
                      onClick={() => setStep("password")}
                      disabled={confirmText !== confirmKeyword}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${activeModal === "tutup-buku" ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"}`}
                    >
                      Konfirmasi →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Password */}
              {step === "password" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <ShieldAlert className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-blue-800">
                      Masukkan password akun Anda untuk mengotorisasi operasi ini.
                    </p>
                  </div>
                  <div>
                    <label className="label mb-1">Password Anda</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !loading && handleExecute()}
                        className="glass-input w-full pr-12"
                        placeholder="Masukkan password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep("confirm")} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors disabled:opacity-40">
                      ← Kembali
                    </button>
                    <button
                      onClick={handleExecute}
                      disabled={loading || !password}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 ${activeModal === "tutup-buku" ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"}`}
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
                      ) : (
                        <>
                          <ShieldAlert className="w-4 h-4" />
                          {activeModal === "tutup-buku" ? "Eksekusi Tutup Buku" : "Hapus Sekarang"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Done */}
              {step === "done" && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center py-2">
                    <CheckCircle2 className="w-14 h-14 text-green-500 mb-3" />
                    <h4 className="font-bold text-gray-800 text-lg">Operasi Berhasil!</h4>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{resultMessage}</p>
                  </div>
                  {resultDetail && (
                    <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
                      <p className="font-semibold text-gray-700 mb-2">Detail Hasil:</p>
                      {Object.entries(resultDetail).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-gray-600">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="font-semibold text-gray-800">{val.toLocaleString("id-ID")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={closeModal}
                    className="w-full px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    Selesai
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

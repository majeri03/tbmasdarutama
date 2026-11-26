"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, Mail, Save, Loader2, Plus, Trash2, ShieldAlert, Send, CheckCircle } from "lucide-react";
import { getStoreSetting, updateStoreSetting } from "@/lib/actions/store-setting.actions";
import {
  getDebtRecipients,
  addDebtRecipient,
  deleteDebtRecipient,
  toggleDebtRecipient,
  getLastDebtEmailLog,
  sendTestDebtEmail,
} from "@/lib/actions/debt-notification.actions";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";

// PKG-H (23 Nov 2026, email pengingat utang): tab "Notifikasi Utang" di
// Pengaturan — KHUSUS SUPER_ADMIN (server juga menolak role lain di
// debt-notification.actions + updateStoreSetting/MANAGE_STORE_SETTINGS).
// Isinya: daftar email penerima ringkasan utang + jadwal pengingat
// (3 hari / 1 minggu / 1 bulan lewat jatuh tempo — bisa diubah) +
// jendela "akan jatuh tempo" + info terakhir terkirim + kirim email tes.
// Email dikirim cron harian 08:00 WITA, satu ringkasan per hari, hanya
// kalau ada utang yang tepat mencapai salah satu tonggak pengingat.

type RecipientRow = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
};

type LastLogRow = {
  sentAt: Date;
  customerOverdue: number;
  customerDueSoon: number;
  supplierOverdue: number;
  supplierDueSoon: number;
  recipientCount: number;
  totalCustomer: number;
  totalSupplier: number;
};

function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatTanggal(d: Date): string {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Normalisasi 3 input hari jadi string "3,7,30" (kosong = tonggak mati).
// Kembalikan null kalau tidak ada satu pun tonggak yang valid.
function normalizeReminderDays(values: string[]): string | null {
  const days = values
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 365);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length > 0 ? unique.join(",") : null;
}

export default function DebtNotificationTab() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debtEmailEnabled, setDebtEmailEnabled] = useState(true);
  const [milestone1, setMilestone1] = useState("3");
  const [milestone2, setMilestone2] = useState("7");
  const [milestone3, setMilestone3] = useState("30");
  const [daysBefore, setDaysBefore] = useState("3");

  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [lastLog, setLastLog] = useState<LastLogRow | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  // FIX WS-K (25 Nov 2026, batch 6 item 174/176): ganti window.confirm
  // dengan modal di dalam aplikasi + simpan hasil kirim tes di layar.
  // window.confirm tidak muncul di browser tes otomatis (auto-dismiss)
  // dan tidak bisa diandalkan di WebView/APK — itulah kenapa tombol
  // Hapus diklik 3x tanpa modal/toast. testResult bertahan di layar
  // (toast hanya 3 detik) supaya hasil kirim tes selalu terlihat.
  const [deletingRecipient, setDeletingRecipient] = useState<RecipientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; at: Date; message: string } | null>(null);

  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSettings();
      fetchRecipients();
      fetchLastLog();
    }
  }, [isSuperAdmin]);

  const fetchSettings = async () => {
    const result = await getStoreSetting();
    if (result.success && result.data) {
      const s = result.data as {
        debtEmailEnabled?: boolean;
        debtReminderDays?: string;
        debtEmailDaysBefore?: number;
      };
      setDebtEmailEnabled(s.debtEmailEnabled ?? true);
      const parts = (s.debtReminderDays ?? "3,7,30").split(",");
      setMilestone1(parts[0] ?? "");
      setMilestone2(parts[1] ?? "");
      setMilestone3(parts[2] ?? "");
      setDaysBefore(String(s.debtEmailDaysBefore ?? 3));
    }
  };

  const fetchRecipients = async () => {
    try {
      const result = await getDebtRecipients();
      if (result.success && Array.isArray(result.data)) {
        setRecipients(result.data as RecipientRow[]);
      }
    } catch {
      showToast("Gagal memuat daftar penerima email", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchLastLog = async () => {
    const result = await getLastDebtEmailLog();
    if (result.success) {
      setLastLog((result.data as LastLogRow | null) ?? null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeReminderDays([milestone1, milestone2, milestone3]);
    if (!normalized) {
      showToast("Isi minimal satu hari pengingat (1–365 hari)", "error");
      return;
    }
    const before = Number(daysBefore);
    if (!Number.isInteger(before) || before < 0 || before > 30) {
      showToast("Jendela 'akan jatuh tempo' harus 0–30 hari", "error");
      return;
    }
    setSaving(true);
    try {
      const result = await updateStoreSetting({
        debtEmailEnabled,
        debtReminderDays: normalized,
        debtEmailDaysBefore: before,
      });
      if (result.success) {
        showToast("Pengaturan notifikasi utang berhasil disimpan", "success");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menyimpan pengaturan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      showToast("Email penerima wajib diisi", "error");
      return;
    }
    setAdding(true);
    try {
      const result = await addDebtRecipient({ email: newEmail.trim(), name: newName.trim() || null });
      if (result.success) {
        showToast(result.message || "Penerima berhasil ditambahkan", "success");
        setNewEmail("");
        setNewName("");
        // FIX WS-K (25 Nov 2026, batch 6 item 7): daftar harus refresh
        // otomatis setelah tambah. Sebelumnya fetchRecipients() dipanggil
        // tanpa await (fire-and-forget) sehingga daftar kadang terlihat
        // belum berubah sampai reload. Sekarang: tampilkan dulu hasil
        // tambah secara optimistis, lalu refresh dari server.
        if (result.data) {
          setRecipients((prev) => [...prev, result.data as RecipientRow]);
        }
        await fetchRecipients();
      } else {
        throw new Error(result.error || "Gagal menambahkan penerima");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menambahkan penerima", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleRecipient = async (id: string) => {
    try {
      const result = await toggleDebtRecipient(id);
      if (!result.success) throw new Error(result.error || "Gagal mengubah status penerima");
      showToast(result.message || "Status penerima diubah", "success");
      // FIX WS-K (25 Nov 2026, batch 6 item 7): refresh daftar otomatis
      // setelah toggle (optimistis dulu, lalu refresh dari server).
      setRecipients((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
      );
      await fetchRecipients();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengubah status penerima", "error");
    }
  };

  // FIX WS-K (25 Nov 2026, batch 6 item 174): hapus penerima pakai
  // modal di dalam aplikasi, BUKAN window.confirm. window.confirm
  // tidak muncul di browser tes otomatis (dialog auto-dismiss -> klik
  // diam-diam batal, tanpa toast) dan tidak bisa diandalkan di
  // WebView/APK. Pola yang sama menjelaskan item 166 (hapus salesman)
  // yang juga pakai window.confirm dan gagal dengan gejala identik.
  const handleDeleteRecipient = (recipient: RecipientRow) => {
    setDeletingRecipient(recipient);
  };

  const handleConfirmDeleteRecipient = async () => {
    if (!deletingRecipient) return;
    setDeleting(true);
    try {
      const result = await deleteDebtRecipient(deletingRecipient.id);
      if (!result.success) throw new Error(result.error || "Gagal menghapus penerima");
      showToast(result.message || "Penerima berhasil dihapus", "success");
      setRecipients((prev) => prev.filter((r) => r.id !== deletingRecipient.id));
      setDeletingRecipient(null);
      await fetchRecipients();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menghapus penerima", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      const result = await sendTestDebtEmail();
      if (result.success) {
        // FIX WS-K (25 Nov 2026, batch 6 item 176): hasil kirim tes
        // dicatat di layar (testResult) BUKAN hanya toast 3 detik —
        // di tes batch 6 tombol sempat "Mengirim..." lalu normal tanpa
        // konfirmasi apa pun yang terlihat. Catatan: email TES sengaja
        // TIDAK menulis DebtEmailLog (dedup harian di
        // NotificationService membaca tabel itu — satu baris tes akan
        // menahan email ringkasan asli hari itu), jadi "Pengiriman
        // Terakhir" di bawah tetap hanya menampilkan kirim harian asli.
        const message = result.message || "Email tes terkirim";
        showToast(message, "success");
        setTestResult({ ok: true, at: new Date(), message });
        fetchLastLog();
      } else {
        throw new Error(result.error || "Gagal mengirim email tes");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengirim email tes";
      showToast(message, "error");
      setTestResult({ ok: false, at: new Date(), message });
    } finally {
      setSendingTest(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/[0.08] border border-amber-500/30">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200">
          Tab Notifikasi Utang hanya untuk SUPER_ADMIN. Daftar email penerima
          dan jadwal pengingat utang hanya bisa diubah oleh pemilik toko.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      {/* ---------- Jadwal & Saklar ---------- */}
      <form onSubmit={handleSaveSettings} className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#E5484D]" />
          <h2 className="text-lg font-semibold text-stone-100">Email Pengingat Utang</h2>
        </div>
        <p className="text-sm text-stone-400">
          Sekali sehari (pukul 08:00 WITA) sistem mengirim satu email ringkasan
          — piutang pelanggan dan utang supplier yang sudah jatuh tempo, plus
          yang akan jatuh tempo. Email hanya dikirim pada hari ketika ada utang
          yang tepat mencapai salah satu tonggak pengingat di bawah ini.
          Tombol di dalam email membuka langsung halaman utang di aplikasi web.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={debtEmailEnabled}
            onChange={(e) => setDebtEmailEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#E5484D] rounded focus:ring-[#E5484D]"
          />
          <span className="text-sm font-medium text-stone-300">Aktifkan email pengingat utang</span>
        </label>
        <div>
          <label className="label">Ingatkan saat utang sudah lewat jatuh tempo selama (hari)</label>
          <p className="text-xs text-stone-400 mb-2">
            Satu utang diingatkan maksimal 3 kali — isi hari ke-1, ke-2, dan ke-3.
            Kosongkan satu kolom kalau tonggak itu tidak dipakai.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={milestone1}
              onChange={(e) => setMilestone1(e.target.value)}
              className="glass-input w-24"
              placeholder="3"
            />
            <span className="text-sm text-stone-400">hari,</span>
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={milestone2}
              onChange={(e) => setMilestone2(e.target.value)}
              className="glass-input w-24"
              placeholder="7"
            />
            <span className="text-sm text-stone-400">hari, dan</span>
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={milestone3}
              onChange={(e) => setMilestone3(e.target.value)}
              className="glass-input w-24"
              placeholder="30"
            />
            <span className="text-sm text-stone-400">hari.</span>
          </div>
        </div>
        <div>
          <label className="label">Sertakan juga utang yang akan jatuh tempo dalam (hari)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={30}
              step={1}
              value={daysBefore}
              onChange={(e) => setDaysBefore(e.target.value)}
              className="glass-input w-24"
              placeholder="3"
            />
            <span className="text-sm text-stone-400">hari ke depan.</span>
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Pengaturan
        </button>
      </form>

      {/* ---------- Daftar Penerima ---------- */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#E5484D]" />
          <h2 className="text-lg font-semibold text-stone-100">Email Penerima</h2>
        </div>
        <p className="text-sm text-stone-400">
          Email ringkasan dikirim ke setiap alamat aktif di bawah ini (satu
          email per alamat, supaya alamat penerima lain tidak saling terlihat).
        </p>

        <form onSubmit={handleAddRecipient} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label label-required">Email penerima</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="glass-input w-64"
              placeholder="nama@email.com"
              maxLength={100}
            />
          </div>
          <div>
            <label className="label">Nama (opsional)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="glass-input w-44"
              placeholder="Nama pemilik email"
              maxLength={100}
            />
          </div>
          <button type="submit" disabled={adding} className="btn-primary inline-flex items-center gap-2">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Tambah
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-stone-400">Memuat daftar penerima…</p>
        ) : recipients.length === 0 ? (
          <p className="text-sm text-stone-400">Belum ada penerima. Tambahkan dulu email yang menerima pengingat utang.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-400 border-b">
                  <th className="py-2 pr-2 font-medium">Email</th>
                  <th className="py-2 pr-2 font-medium">Nama</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium text-stone-200">{r.email}</td>
                    <td className="py-2 pr-2 text-stone-400">{r.name || "-"}</td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRecipient(r.id)}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          r.isActive ? "bg-green-500/15 text-green-400" : "bg-white/[0.08] text-stone-400"
                        }`}
                        title="Klik untuk mengubah status"
                      >
                        {r.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDeleteRecipient(r)}
                        className="btn-secondary !py-1 !px-3 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Terakhir Terkirim + Tes ---------- */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5 text-[#E5484D]" />
          <h2 className="text-lg font-semibold text-stone-100">Pengiriman Terakhir &amp; Tes</h2>
        </div>
        {lastLog ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/[0.08] border border-green-500/30">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-300">
              Terakhir terkirim <strong>{formatTanggal(lastLog.sentAt)}</strong> ke{" "}
              <strong>{lastLog.recipientCount} penerima</strong>: {lastLog.customerOverdue} piutang
              jatuh tempo ({formatRupiah(lastLog.totalCustomer)}) dan {lastLog.supplierOverdue} utang
              supplier jatuh tempo ({formatRupiah(lastLog.totalSupplier)}), plus{" "}
              {lastLog.customerDueSoon} piutang dan {lastLog.supplierDueSoon} utang supplier yang
              akan jatuh tempo.
            </p>
          </div>
        ) : (
          // FIX WS-K (25 Nov 2026, batch 6 item 175): keadaan "belum
          // pernah terkirim" ditulis jelas + alasannya, supaya tidak
          // terlihat seperti bagian yang rusak/kosong. Email harian
          // hanya terkirim pada hari ada utang yang tepat mencapai
          // tonggak pengingat — jadi kosong itu keadaan normal kalau
          // belum ada tonggak yang tercapai / belum ada penerima aktif.
          <div className="p-4 rounded-lg bg-white/[0.06] border border-white/10">
            <p className="text-sm text-stone-300 font-medium">Belum pernah ada email ringkasan utang yang terkirim.</p>
            <p className="text-sm text-stone-400 mt-1">
              Email ringkasan harian hanya dikirim (pukul 08:00 WITA) pada hari ada utang yang tepat
              mencapai salah satu tonggak pengingat di atas, dan hanya ke{" "}
              {recipients.filter((r) => r.isActive).length} penerima aktif saat ini. Pakai tombol
              &ldquo;Kirim Email Tes&rdquo; di bawah untuk memastikan pengiriman email berfungsi.
            </p>
          </div>
        )}
        {testResult && (
          <div
            className={`flex items-start gap-3 p-4 rounded-lg border ${
              testResult.ok ? "bg-green-500/[0.08] border-green-500/30" : "bg-red-500/[0.08] border-red-500/30"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${testResult.ok ? "text-green-300" : "text-red-300"}`}>
              <strong>{testResult.ok ? "Email tes terkirim" : "Email tes gagal"}</strong>{" "}
              ({formatTanggal(testResult.at)}): {testResult.message} Email tes tidak masuk ke
              &ldquo;Pengiriman Terakhir&rdquo; di atas supaya tidak mengganggu jadwal harian.
            </p>
          </div>
        )}
        <p className="text-sm text-stone-400">
          Email tes memakai data utang saat ini (atau satu baris contoh kalau belum ada utang),
          dan tidak memengaruhi jadwal harian. Kalau belum ada penerima aktif, email tes dikirim
          ke email akun Anda sendiri.
        </p>
        <button type="button" onClick={handleSendTest} disabled={sendingTest} className="btn-secondary inline-flex items-center gap-2">
          {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Kirim Email Tes
        </button>
      </div>

      {/* ---------- Modal konfirmasi hapus penerima (item 174) ---------- */}
      {deletingRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1C1917] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-[#7F1D1D]">
              <h3 className="font-bold text-white text-lg">Hapus Penerima Email?</h3>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-stone-300 leading-relaxed">
                Hapus <strong>{deletingRecipient.email}</strong> dari daftar penerima email pengingat
                utang? Alamat ini tidak akan lagi menerima ringkasan utang harian.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingRecipient(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-stone-400 hover:bg-white/[0.06] font-medium text-sm transition-colors disabled:opacity-40"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteRecipient}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7F1D1D] hover:bg-[#991B1B] text-white font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Menghapus...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Ya, Hapus
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

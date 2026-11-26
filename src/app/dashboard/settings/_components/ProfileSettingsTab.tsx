"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";
import ChangePasswordForm from "./ChangePasswordForm";

/**
 * Tab Profil Akun — info user (nama/email/role dari sesi, diisi callback
 * jwt/session di src/lib/auth.ts) + foto profil + form ubah password.
 *
 * WS-9 (26 Nov 2026):
 * - Foto profil: upload/ganti/hapus lewat POST/DELETE /api/profile/avatar.
 *   Batas: maks 2 MB, hanya JPG/PNG/WebP — dicek di sini (client) DAN di
 *   server (route avatar). Batasnya ditampilkan di bawah tombol.
 *   Habis upload/hapus, session.update() dipanggil supaya sesi membawa
 *   avatarUrl baru dari DB tanpa login ulang.
 * - Form ubah password PINDAH ke sini dari tab "Ganti Password" sendiri
 *   (komponen ChangePasswordForm, isinya tidak berubah). Tidak ada lagi
 *   tab ganti password terpisah — hanya satu tempat ganti password.
 */
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

export default function ProfileSettingsTab() {
  const { data: session, status, update } = useSession();
  const { toast, showToast, hideToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // avatarUrl lokal supaya foto baru langsung tampil tanpa menunggu
  // session selesai refresh; nilai awal dari sesi.
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(
    undefined
  );
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentAvatarUrl =
    avatarUrl === undefined ? session?.user?.avatarUrl ?? null : avatarUrl;

  if (status === "loading") {
    return (
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900">Profil Akun</h2>
        <p className="mt-1 text-sm text-gray-500">Memuat data akun…</p>
        <div className="mt-6 space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-b border-gray-100 pb-4">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900">Profil Akun</h2>
        <p className="mt-1 text-sm text-gray-500">
          Sesi tidak ditemukan. Silakan login ulang untuk melihat profil Anda.
        </p>
      </div>
    );
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "Nama Lengkap", value: session.user.name || "—" },
    { label: "Alamat Email", value: session.user.email || "—" },
    { label: "Peran (Role)", value: session.user.role || "—" },
  ];

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input supaya file yang sama bisa dipilih lagi setelah gagal.
    e.target.value = "";
    if (!file) return;

    // Validasi client (server di route avatar menegakkan aturan yang sama):
    // hanya JPG/PNG/WebP, maks 2 MB.
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast("File harus berupa gambar (JPG, PNG, atau WebP).", "error");
      return;
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      showToast("Ukuran foto maksimal 2 MB. Pilih foto yang lebih kecil.", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengunggah foto profil.");
      }
      setAvatarUrl(data.data.avatarUrl as string);
      // Segarkan sesi supaya avatarUrl baru ikut ke session.user.
      await update();
      showToast("Foto profil berhasil diunggah.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal mengunggah foto profil.",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!currentAvatarUrl) return;
    if (!window.confirm("Hapus foto profil Anda?")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menghapus foto profil.");
      }
      setAvatarUrl(null);
      await update();
      showToast("Foto profil berhasil dihapus.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal menghapus foto profil.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      {/* Foto profil */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">Profil Akun</h2>
        <p className="mt-1 text-sm text-gray-500">
          Informasi akun Anda. Data ini hanya untuk dilihat.
        </p>

        <div className="mt-6 flex items-center gap-5">
          {currentAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentAvatarUrl}
              alt="Foto profil"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-2xl font-bold text-gray-600">
              {(session.user.name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePickFile}
                disabled={uploading || deleting}
                className="btn-primary"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengunggah…
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    {currentAvatarUrl ? "Ganti Foto" : "Upload Foto"}
                  </>
                )}
              </button>
              {currentAvatarUrl && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  disabled={uploading || deleting}
                  className="btn-secondary"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menghapus…
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Hapus Foto
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Maks. 2 MB • JPG, PNG, atau WebP
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <dl className="mt-6 divide-y divide-gray-100 border-y border-gray-100">
          {rows.map((row) => (
            <div key={row.label} className="py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {row.label}
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{row.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-gray-400">
          Untuk mengubah nama atau email, hubungi admin toko.
        </p>
      </section>

      {/* Ubah password — pindahan dari tab "Ganti Password" (WS-9). */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">Ubah Password</h3>
        <p className="mt-1 text-sm text-gray-500">
          Ganti password akun Anda di sini.
        </p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}

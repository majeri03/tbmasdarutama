"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Loader2, Save } from "lucide-react";
import { userFormSchema, UserFormValues } from "@/lib/validations/user.schema";
import { createUser, updateUser } from "@/lib/actions/user.actions";
import PasswordChecklist from "@/components/ui/password-checklist";
import { useToast, Toast } from "@/components/ui/toast";

// 1. Definisikan tipe data User (sesuai output dari getUsers)
interface UserData {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "KASIR"; // Sesuaikan dengan Enum Prisma
  phone: string | null;
  address: string | null;
  isActive: boolean;
  // FIX (24 Nov 2026, OTP): dipakai untuk menyembunyikan checkbox
  // "Akun Aktif" pada akun yang emailnya belum terverifikasi.
  emailVerifiedAt: Date | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // 2. Ganti 'any' dengan tipe UserData yang proper
  initialData?: UserData | null; 
}

export function UserFormModal({ isOpen, onClose, initialData }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    // 3. Pastikan defaultValues selalu terisi lengkap untuk menghindari tipe undefined
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "KASIR",
      phone: "",
      address: "",
      isActive: true, // Default true untuk user baru
    },
  });

  // Reset form saat modal dibuka atau initialData berubah
  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            form.reset({
                name: initialData.name,
                email: initialData.email,
                role: initialData.role,
                phone: initialData.phone || "",
                address: initialData.address || "",
                isActive: initialData.isActive,
                password: "", 
            });
        } else {
            form.reset({
                name: "",
                email: "",
                password: "",
                role: "KASIR",
                phone: "",
                address: "",
                isActive: true, // Default user baru = Aktif
            });
        }
    }
  }, [isOpen, initialData, form]);

  // Nilai password saat ini — checklist hanya tampil saat kolom diisi
  // (saat edit, kosong = password tidak diubah). Submit diblokir
  // client-side oleh zod schema (user.schema.ts) kalau password yang
  // diisi tidak lolos aturan; server (createUser/updateUser) menolak
  // juga, jadi client tidak bisa bypass.
  const passwordValue = form.watch("password") || "";

  const onSubmit = async (data: UserFormValues) => {
    setIsLoading(true);
    try {
      let result;
      if (initialData) {
        result = await updateUser(initialData.id, data);
      } else {
        result = await createUser(data);
      }

      if (result.success) {
        showToast(result.message!, "success");
        setTimeout(() => {
            onClose();
        }, 1500);
      } else {
        showToast(result.error || "Terjadi kesalahan", "error");
      }
    } catch {
      showToast("Terjadi kesalahan sistem", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
        {toast && (
        <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={hideToast} 
        />
      )}
      {/* WS-6b (27 Nov 2026): overflow-hidden dihapus — menimpa aturan
          scroll .modal-container sehingga form user panjang terpotong. */}
      <div className="modal-container w-full max-w-lg animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-stone-200">
            {initialData ? "Edit User" : "Tambah User Baru"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Nama & Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-400">Nama Lengkap</label>
                <input
                {...form.register("name")}
                className="glass-input text-sm"
                placeholder="Nama user"
                />
                {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-400">Email</label>
                <input
                type="email"
                {...form.register("email")}
                className="glass-input text-sm"
                placeholder="email@contoh.com"
                />
                {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
            </div>
          </div>

          {/* Password & Role */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-400">
                    Password {initialData && <span className="text-stone-500 font-normal">(Isi jika ingin ubah)</span>}
                </label>
                <input
                type="password"
                {...form.register("password")}
                className="glass-input text-sm"
                placeholder="******"
                />
                {passwordValue && (
                  <PasswordChecklist password={passwordValue} />
                )}
                {form.formState.errors.password && <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-400">Role</label>
                <select
                {...form.register("role")}
                className="w-full px-3 py-2 border border-white/15 rounded-xl focus:ring-2 focus:ring-[#E5484D] focus:border-[#E5484D] outline-none transition-all text-sm bg-[#1C1917] [color-scheme:dark]"
                >
                    <option value="KASIR">Kasir</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                </select>
                {form.formState.errors.role && <p className="text-xs text-red-500">{form.formState.errors.role.message}</p>}
            </div>
          </div>

          {/* Phone & Address */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-400">No. Telepon</label>
            <input
              {...form.register("phone")}
              className="glass-input text-sm"
              placeholder="08..."
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-400">Alamat</label>
            <textarea
              {...form.register("address")}
              rows={2}
              className="glass-input text-sm resize-none"
              placeholder="Alamat lengkap..."
            />
          </div>

          {/* Status akun
              FIX (24 Nov 2026, OTP bypass): akun yang emailnya BELUM
              terverifikasi TIDAK BOLEH diaktifkan dari form edit — dulu
              checkbox "Akun Aktif" di sini langsung mengaktifkan akun
              tanpa kode OTP (lihat updateUser). Aktivasi sekarang hanya
              lewat kode OTP di /verify-email.
              Checkbox hanya tampil kalau email sudah terverifikasi
              (akun aktif / pernah aktif) atau akun sedang aktif, supaya
              admin tetap bisa MENONAKTIFKAN akun, dan mengaktifkan
              kembali akun yang emailnya sudah terverifikasi. */}
          {initialData ? (
            initialData.isActive || initialData.emailVerifiedAt ? (
              <div className="flex items-center gap-2 pt-2">
                <input
                    type="checkbox"
                    id="isActive"
                    {...form.register("isActive")}
                    className="w-4 h-4 accent-[#E5484D] rounded border-white/15 focus:ring-[#E5484D]"
                />
                <label htmlFor="isActive" className="text-sm text-stone-300 cursor-pointer select-none">
                    Akun Aktif (Dapat Login)
                </label>
              </div>
            ) : (
              <div className="flex items-start gap-2 pt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-amber-300">
                  Akun ini belum terverifikasi dan belum bisa login. Akun hanya
                  bisa aktif setelah pemiliknya memasukkan kode OTP 6 digit di{" "}
                  <a
                    href={`/verify-email?email=${encodeURIComponent(initialData.email)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    halaman verifikasi
                  </a>
                  . Centang &quot;Akun Aktif&quot; sengaja dihapus dari form ini.
                </p>
              </div>
            )
          ) : (
            <div className="flex items-start gap-2 pt-2 p-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30">
              <p className="text-sm text-red-300">
                Akun baru dibuat nonaktif dan harus verifikasi email dulu: kode OTP 6 digit
                dikirim ke email di atas. Akun baru bisa login setelah kodenya dimasukkan
                di halaman verifikasi.
              </p>
            </div>
          )}

          <div className="pt-4 -mx-6 -mb-6 px-6 pb-6 bg-white/5 flex justify-end gap-3 border-t border-white/10 mt-4 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-stone-300 bg-white/10 rounded-xl hover:bg-white/15 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-900 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 hover:bg-red-800"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
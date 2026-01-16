"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Loader2, Save } from "lucide-react";
import { userFormSchema, UserFormValues } from "@/lib/validations/user.schema";
import { createUser, updateUser } from "@/lib/actions/user.actions";
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        {toast && (
        <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={hideToast} 
        />
      )}
      <div className="glass-card w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {initialData ? "Edit User" : "Tambah User Baru"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Nama & Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Nama Lengkap</label>
                <input
                {...form.register("name")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="Nama user"
                />
                {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Email</label>
                <input
                type="email"
                {...form.register("email")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="email@contoh.com"
                />
                {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
            </div>
          </div>

          {/* Password & Role */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                    Password {initialData && <span className="text-gray-400 font-normal">(Isi jika ingin ubah)</span>}
                </label>
                <input
                type="password"
                {...form.register("password")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="******"
                />
                {form.formState.errors.password && <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Role</label>
                <select
                {...form.register("role")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm bg-white"
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
            <label className="text-xs font-semibold text-gray-600">No. Telepon</label>
            <input
              {...form.register("phone")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
              placeholder="08..."
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Alamat</label>
            <textarea
              {...form.register("address")}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-none"
              placeholder="Alamat lengkap..."
            />
          </div>

          {/* Status Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
                type="checkbox"
                id="isActive"
                {...form.register("isActive")}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer select-none">
                Akun Aktif (Dapat Login)
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
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
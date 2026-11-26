"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, Save, Loader2, Truck, Phone, Mail, MapPin } from "lucide-react";
import { createSupplier, updateSupplier } from "@/lib/actions/supplier.actions";

interface SupplierFormModalProps {
  supplier?: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    description: string | null;
    isActive: boolean;
  };
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function SupplierFormModal({
  supplier,
  onClose,
  onSuccess,
  onError,
}: SupplierFormModalProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!supplier;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: supplier?.name || "",
      phone: supplier?.phone || "",
      email: supplier?.email || "",
      address: supplier?.address || "",
      city: supplier?.city || "",
      province: supplier?.province || "",
      description: supplier?.description || "",
      isActive: supplier?.isActive ?? true,
    },
  });

  useEffect(() => {
    if (supplier) {
      reset({
        name: supplier.name,
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        city: supplier.city || "",
        province: supplier.province || "",
        description: supplier.description || "",
        isActive: supplier.isActive,
      });
    }
  }, [supplier, reset]);

  const onSubmit = async (data: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    province: string;
    description: string;
    isActive: boolean;
  }) => {
    setLoading(true);

    try {
      const formData = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        province: data.province?.trim() || null,
        description: data.description?.trim() || null,
        isActive: data.isActive,
      };

      const result = isEdit
        ? await updateSupplier(supplier.id, formData)
        : await createSupplier(formData);

      if (result.success) {
        onSuccess(result.message!);
        onClose();
        reset();
      } else {
        onError(result.error!);
      }
    } catch {
      onError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay overflow-y-auto">
      <div className="modal-container p-6 w-full max-w-2xl animate-slide-up my-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
              }}
            >
              <Truck className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-stone-900">
                {isEdit ? "Edit Supplier" : "Tambah Supplier"}
              </h3>
              <p className="text-sm text-stone-600 mt-0.5">
                {isEdit
                  ? `Kode: ${supplier.code}`
                  : "Kode akan digenerate otomatis"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Grid 2 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nama Supplier */}
            <div className="space-y-2">
              <label htmlFor="name" className="label">
                Nama Supplier <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                placeholder="CV. Maju Bersama"
                className="glass-input"
                disabled={loading}
                {...register("name", {
                  required: "Nama supplier wajib diisi",
                  maxLength: { value: 100, message: "Nama maksimal 100 karakter" },
                })}
              />
              {errors.name && (
                <p className="text-xs text-red-800 mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Nomor Telepon */}
            <div className="space-y-2">
              <label htmlFor="phone" className="label">
                Nomor Telepon <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="phone"
                  type="tel"
                  placeholder="081234567890"
                  className="glass-input pl-11"
                  disabled={loading}
                  {...register("phone", {
                    required: "Nomor telepon wajib diisi",
                    pattern: {
                      value: /^[0-9+\-() ]+$/,
                      message: "Format nomor telepon tidak valid",
                    },
                  })}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-red-800 mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="label">
              Email <span className="text-stone-400">(Opsional)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                id="email"
                type="email"
                placeholder="supplier@example.com"
                className="glass-input pl-11"
                disabled={loading}
                {...register("email", {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Format email tidak valid",
                  },
                })}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-800 mt-1 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Alamat */}
          <div className="space-y-2">
            <label htmlFor="address" className="label">
              Alamat <span className="text-stone-400">(Opsional)</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-4 w-4 h-4 text-stone-400" />
              <textarea
                id="address"
                rows={2}
                placeholder="Jl. Contoh No. 123"
                className="glass-input pl-11 resize-none"
                disabled={loading}
                {...register("address")}
              />
            </div>
          </div>

          {/* Grid 2 Columns - City & Province */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Kota */}
            <div className="space-y-2">
              <label htmlFor="city" className="label">
                Kota <span className="text-stone-400">(Opsional)</span>
              </label>
              <input
                id="city"
                type="text"
                placeholder="Jakarta"
                className="glass-input"
                disabled={loading}
                {...register("city")}
              />
            </div>

            {/* Provinsi */}
            <div className="space-y-2">
              <label htmlFor="province" className="label">
                Provinsi <span className="text-stone-400">(Opsional)</span>
              </label>
              <input
                id="province"
                type="text"
                placeholder="DKI Jakarta"
                className="glass-input"
                disabled={loading}
                {...register("province")}
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div className="space-y-2">
            <label htmlFor="description" className="label">
              Deskripsi <span className="text-stone-400">(Opsional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="Catatan tambahan tentang supplier"
              className="glass-input resize-none"
              disabled={loading}
              {...register("description")}
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <input
              id="isActive"
              type="checkbox"
              className="w-5 h-5 rounded border-stone-300 text-green-700 focus:ring-green-700"
              disabled={loading}
              {...register("isActive")}
            />
            <label htmlFor="isActive" className="text-sm font-semibold text-stone-700">
              Supplier Aktif
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 -mx-6 -mb-6 px-6 pb-6 bg-stone-50 border-t border-stone-200 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Batal
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEdit ? "Menyimpan..." : "Menambahkan..."}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEdit ? "Simpan Perubahan" : "Tambah Supplier"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
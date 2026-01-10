"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, Save, Loader2, Package } from "lucide-react";
import { createUnit, UnitFormData, updateUnit } from "@/lib/actions/unit.actions";

interface UnitFormModalProps {
  unit?: {
    id: string;
    name: string;
    description: string | null;
  };
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function UnitFormModal({
  unit,
  onClose,
  onSuccess,
  onError,
}: UnitFormModalProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!unit;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: unit?.name || "",
      description: unit?.description || "",
    },
  });

  useEffect(() => {
    if (unit) {
      reset({
        name: unit.name,
        description: unit.description || "",
      });
    }
  }, [unit, reset]);

  const onSubmit = async (data: { name: string; description: string }) => {
    setLoading(true);

    try {
      // Transform data untuk server action
      const formData = {
        name: data.name.toUpperCase().trim(),
        description: data.description?.trim() || null,
      };

      const result = isEdit
        ? await updateUnit(unit.id, formData as UnitFormData)
        : await createUnit(formData as UnitFormData);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="glass-card p-6 w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{
                background: "rgba(96, 165, 250, 0.15)",
                border: "1px solid rgba(96, 165, 250, 0.3)",
              }}
            >
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {isEdit ? "Edit Satuan" : "Tambah Satuan"}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {isEdit
                  ? "Perbarui informasi satuan"
                  : "Tambahkan satuan produk baru"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Nama Satuan */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-gray-700"
            >
              Nama Satuan <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="Contoh: PCS, BOX, SAK, KG"
              className="glass-input"
              disabled={loading}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.name.message}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Nama akan otomatis diubah ke huruf kapital
            </p>
          </div>

          {/* Deskripsi */}
          <div className="space-y-2">
            <label
              htmlFor="description"
              className="block text-sm font-semibold text-gray-700"
            >
              Deskripsi <span className="text-gray-400">(Opsional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="Tambahkan deskripsi satuan (opsional)"
              className="glass-input resize-none"
              disabled={loading}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
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
                  <span>{isEdit ? "Simpan Perubahan" : "Tambah Satuan"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
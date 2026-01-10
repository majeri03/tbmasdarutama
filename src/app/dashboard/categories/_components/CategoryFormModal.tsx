"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, Save, Loader2, FolderTree } from "lucide-react";
import { createCategory, updateCategory } from "@/lib/actions/category.actions";

interface CategoryFormModalProps {
  category?: {
    id: string;
    name: string;
    description: string | null;
  };
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function CategoryFormModal({
  category,
  onClose,
  onSuccess,
  onError,
}: CategoryFormModalProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!category;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
    },
  });

  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || "",
      });
    }
  }, [category, reset]);

  const onSubmit = async (data: { name: string; description: string }) => {
    setLoading(true);

    try {
      const formData = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      };

      const result = isEdit
        ? await updateCategory(category.id, formData)
        : await createCategory(formData);

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
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{
                background: "rgba(96, 165, 250, 0.15)",
                border: "1px solid rgba(96, 165, 250, 0.3)",
              }}
            >
              <FolderTree className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {isEdit ? "Edit Kategori" : "Tambah Kategori"}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {isEdit
                  ? "Perbarui informasi kategori"
                  : "Tambahkan kategori produk baru"}
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-gray-700"
            >
              Nama Kategori <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="Contoh: Bahan Bangunan, Elektronik"
              className="glass-input"
              disabled={loading}
              {...register("name", {
                required: "Nama kategori wajib diisi",
                maxLength: {
                  value: 100,
                  message: "Nama maksimal 100 karakter",
                },
              })}
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.name.message}
              </p>
            )}
          </div>

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
              placeholder="Tambahkan deskripsi kategori (opsional)"
              className="glass-input resize-none"
              disabled={loading}
              {...register("description", {
                maxLength: {
                  value: 500,
                  message: "Deskripsi maksimal 500 karakter",
                },
              })}
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.description.message}
              </p>
            )}
          </div>

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
                  <span>{isEdit ? "Simpan Perubahan" : "Tambah Kategori"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
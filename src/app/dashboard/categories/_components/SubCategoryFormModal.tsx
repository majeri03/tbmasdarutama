"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, Save, Loader2, Folder } from "lucide-react";
import { createSubCategory, updateSubCategory, getCategoriesForSelect } from "@/lib/actions/category.actions";

interface SubCategoryFormModalProps {
  subCategory?: {
    id: string;
    name: string;
    description: string | null;
    categoryId: string;
  };
  preSelectedCategoryId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function SubCategoryFormModal({
  subCategory,
  preSelectedCategoryId,
  onClose,
  onSuccess,
  onError,
}: SubCategoryFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const isEdit = !!subCategory;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: subCategory?.name || "",
      description: subCategory?.description || "",
      categoryId: subCategory?.categoryId || preSelectedCategoryId || "",
    },
  });

  // Fetch categories for select
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const result = await getCategoriesForSelect();
        if (result.success) {
          setCategories(result.data);
        }
      } catch {
        onError("Gagal memuat data kategori");
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [onError]);

  useEffect(() => {
    if (subCategory) {
      reset({
        name: subCategory.name,
        description: subCategory.description || "",
        categoryId: subCategory.categoryId,
      });
    }
  }, [subCategory, reset]);

  const onSubmit = async (data: { name: string; description: string; categoryId: string }) => {
    setLoading(true);

    try {
      const formData = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        categoryId: data.categoryId,
      };

      const result = isEdit
        ? await updateSubCategory(subCategory.id, formData)
        : await createSubCategory(formData);

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
                background: "rgba(167, 139, 250, 0.15)",
                border: "1px solid rgba(167, 139, 250, 0.3)",
              }}
            >
              <Folder className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {isEdit ? "Edit Sub-Kategori" : "Tambah Sub-Kategori"}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {isEdit
                  ? "Perbarui informasi sub-kategori"
                  : "Tambahkan sub-kategori produk baru"}
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
          {/* Kategori Parent */}
          <div className="space-y-2">
            <label
              htmlFor="categoryId"
              className="block text-sm font-semibold text-gray-700"
            >
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              id="categoryId"
              className="glass-input"
              disabled={loading || loadingCategories}
              {...register("categoryId", {
                required: "Kategori wajib dipilih",
              })}
            >
              <option value="">
                {loadingCategories ? "Memuat kategori..." : "Pilih Kategori"}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.categoryId.message}
              </p>
            )}
          </div>

          {/* Nama Sub-Kategori */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-gray-700"
            >
              Nama Sub-Kategori <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="Contoh: Semen, Cat, Paku"
              className="glass-input"
              disabled={loading}
              {...register("name", {
                required: "Nama sub-kategori wajib diisi",
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
              placeholder="Tambahkan deskripsi sub-kategori (opsional)"
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
            <button type="submit" disabled={loading || loadingCategories} className="btn-primary flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEdit ? "Menyimpan..." : "Menambahkan..."}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEdit ? "Simpan Perubahan" : "Tambah Sub-Kategori"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
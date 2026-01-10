"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Package, DollarSign, Image as ImageIcon, ChevronRight, ChevronLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProductSchema, UpdateProductInput, updateProductSchema, type CreateProductInput } from "@/lib/validations/product.schema";
import { createProduct, updateProduct } from "@/lib/actions/product.actions";
import { ProductUnitManager } from "./ProductUnitManager";
import { ProductImageUploader } from "./ProductImageUploader";

interface Category {
  id: string;
  name: string;
}

interface SubCategory {
  id: string;
  name: string;
  categoryId: string; // ✅ Add missing field
}

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

interface ProductUnit {
  unitId: string;
  conversionValue: number;
  buyPrice: number;
  sellPrice: number;
  isPrimary: boolean;
}

interface ProductImage {
  imageUrl: string;
  isPrimary: boolean;
}

interface ProductData {
  id: string;
  name: string;
  barcode: string | null;
  description: string | null;
  categoryId: string;
  subCategoryId: string | null;
  supplierId: string | null;
  minStock: number;
  isActive: boolean;
  productUnits?: Array<{
    unitId: string;
    conversionValue: number;
    buyPrice: string | number;
    sellPrice: string | number;
    isPrimary: boolean;
  }>;
  productImages?: Array<{
    imageUrl: string;
    isPrimary: boolean;
  }>;
}

interface ProductFormModalProps {
  mode: "create" | "edit";
  product?: ProductData;
  categories: Category[];
  subCategories: SubCategory[];
  suppliers: Supplier[];
  units: Unit[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

type FormStep = "basic" | "units" | "images";

// ✅ Define proper form data type
type ProductFormData = {
  name?: string;
  barcode?: string | null;
  description?: string | null;
  categoryId?: string;
  subCategoryId?: string | null;
  supplierId?: string | null;
  minStock?: number;
  isActive?: boolean;
  units?: ProductUnit[];
  images?: ProductImage[];
};
export function ProductFormModal({
  mode,
  product,
  categories,
  subCategories,
  suppliers,
  units,
  onClose,
  onSuccess,
  onError,
}: ProductFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<FormStep>("basic");
  const [formUnits, setFormUnits] = useState<ProductUnit[]>([]);
  const [formImages, setFormImages] = useState<ProductImage[]>([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState<SubCategory[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(mode === "create" ? createProductSchema : updateProductSchema),
    defaultValues: mode === "edit" && product ? {
      name: product.name,
      barcode: product.barcode || "",
      description: product.description || "",
      categoryId: product.categoryId,
      subCategoryId: product.subCategoryId || "",
      supplierId: product.supplierId || "",
      minStock: product.minStock,
      isActive: product.isActive,
    } : {
      name: "",
      barcode: "",
      description: "",
      categoryId: "",
      subCategoryId: "",
      supplierId: "",
      minStock: 0,
      isActive: true,
    },
  });

  const selectedCategoryId = watch("categoryId");

  // Initialize units and images for edit mode
  useEffect(() => {
    if (mode === "edit" && product) {
      if (product.productUnits) {
        setFormUnits(
          product.productUnits.map((pu) => ({
            unitId: pu.unitId,
            conversionValue: pu.conversionValue,
            buyPrice: typeof pu.buyPrice === 'string' ? parseFloat(pu.buyPrice) : pu.buyPrice,
            sellPrice: typeof pu.sellPrice === 'string' ? parseFloat(pu.sellPrice) : pu.sellPrice,
            isPrimary: pu.isPrimary,
          }))
        );
      }
      if (product.productImages) {
        setFormImages(
          product.productImages.map((pi) => ({
            imageUrl: pi.imageUrl,
            isPrimary: pi.isPrimary,
          }))
        );
      }
    }
  }, [mode, product]);

  // Filter sub-categories based on selected category
  useEffect(() => {
    if (selectedCategoryId) {
      const filtered = subCategories.filter(
        (sub) => sub.categoryId === selectedCategoryId
      );
      setFilteredSubCategories(filtered);
      
      // Reset subCategoryId if not in filtered list
      const currentSubCategoryId = watch("subCategoryId");
      if (currentSubCategoryId && !filtered.find(s => s.id === currentSubCategoryId)) {
        setValue("subCategoryId", "");
      }
    } else {
      setFilteredSubCategories([]);
      setValue("subCategoryId", "");
    }
  }, [selectedCategoryId, subCategories, setValue, watch]);

  const onSubmit = async (data: ProductFormData) => {
    // Validate units
    if (formUnits.length === 0) {
      onError("Minimal harus ada 1 satuan!");
      return;
    }

    setLoading(true);

    try {
      const payload: CreateProductInput = {
        name: data.name!,
        barcode: data.barcode || null,
        description: data.description || null,
        categoryId: data.categoryId!,
        subCategoryId: data.subCategoryId || null,
        supplierId: data.supplierId || null,
        minStock: data.minStock!,
        isActive: data.isActive ?? true,
        units: formUnits,
        images: formImages,
      };

      const result =
        mode === "create"
          ? await createProduct(payload)
          : await updateProduct(product!.id, payload as unknown as UpdateProductInput);

      if (result.success) {
        onSuccess(result.message!);
        onClose();
      } else {
        onError(result.error!);
      }
    } catch (error) {
      console.error("Submit error:", error);
      onError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === "basic") {
      setCurrentStep("units");
    } else if (currentStep === "units") {
      if (formUnits.length === 0) {
        onError("Minimal harus ada 1 satuan sebelum lanjut!");
        return;
      }
      setCurrentStep("images");
    }
  };

  const handleBack = () => {
    if (currentStep === "units") {
      setCurrentStep("basic");
    } else if (currentStep === "images") {
      setCurrentStep("units");
    }
  };

  const steps = [
    { id: "basic", label: "Info Dasar", icon: Package },
    { id: "units", label: "Satuan & Harga", icon: DollarSign },
    { id: "images", label: "Gambar", icon: ImageIcon },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-card w-full max-w-4xl my-8 animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === "create" ? "Tambah Produk Baru" : "Edit Produk"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {mode === "create"
                ? "Isi form di bawah untuk menambahkan produk"
                : "Perbarui informasi produk"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted =
                (step.id === "basic" && (currentStep === "units" || currentStep === "images")) ||
                (step.id === "units" && currentStep === "images");

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? "bg-blue-600 text-white scale-110"
                          : isCompleted
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-xs font-semibold mt-2 ${
                        isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded transition-all ${
                        isCompleted ? "bg-green-600" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Step 1: Basic Info */}
            {currentStep === "basic" && (
              <div className="space-y-4 animate-slide-up">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Produk <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("name")}
                      type="text"
                      className="glass-input"
                      placeholder="Contoh: Semen Portland"
                    />
                    {errors.name && (
                      <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Barcode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Barcode (Opsional)
                    </label>
                    <input
                      {...register("barcode")}
                      type="text"
                      className="glass-input"
                      placeholder="Contoh: 8991234567890"
                    />
                    {errors.barcode && (
                      <p className="text-xs text-red-600 mt-1">{errors.barcode.message}</p>
                    )}
                  </div>

                  {/* Min Stock */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Stok <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("minStock", { valueAsNumber: true })}
                      type="number"
                      min="0"
                      className="glass-input"
                      placeholder="0"
                    />
                    {errors.minStock && (
                      <p className="text-xs text-red-600 mt-1">{errors.minStock.message}</p>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <select {...register("categoryId")} className="glass-input">
                      <option value="">Pilih Kategori</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {errors.categoryId && (
                      <p className="text-xs text-red-600 mt-1">{errors.categoryId.message}</p>
                    )}
                  </div>

                  {/* Sub-Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sub-Kategori (Opsional)
                    </label>
                    <select
                      {...register("subCategoryId")}
                      className="glass-input"
                      disabled={!selectedCategoryId || filteredSubCategories.length === 0}
                    >
                      <option value="">Pilih Sub-Kategori</option>
                      {filteredSubCategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                    {!selectedCategoryId && (
                      <p className="text-xs text-gray-500 mt-1">Pilih kategori terlebih dahulu</p>
                    )}
                  </div>

                  {/* Supplier */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier (Opsional)
                    </label>
                    <select {...register("supplierId")} className="glass-input">
                      <option value="">Pilih Supplier</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} ({sup.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deskripsi (Opsional)
                    </label>
                    <textarea
                      {...register("description")}
                      rows={3}
                      className="glass-input"
                      placeholder="Deskripsi produk..."
                    />
                  </div>

                  {/* Is Active */}
                  <div className="md:col-span-2 flex items-center gap-2">
                    <input
                      {...register("isActive")}
                      type="checkbox"
                      id="isActive"
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">
                      Produk aktif dan dapat dijual
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Units & Prices */}
            {currentStep === "units" && (
              <div className="animate-slide-up">
                <ProductUnitManager
                  units={formUnits}
                  availableUnits={units}
                  onChange={setFormUnits}
                  error={errors.units?.message}
                />
              </div>
            )}

            {/* Step 3: Images */}
            {currentStep === "images" && (
              <div className="animate-slide-up">
                <ProductImageUploader
                  images={formImages}
                  onChange={setFormImages}
                  error={errors.images?.message}
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              {currentStep !== "basic" && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="btn-secondary"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Kembali</span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-secondary"
              >
                Batal
              </button>

              {currentStep !== "images" ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  className="btn-primary"
                >
                  <span>Lanjut</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      <span>{mode === "create" ? "Simpan Produk" : "Perbarui Produk"}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
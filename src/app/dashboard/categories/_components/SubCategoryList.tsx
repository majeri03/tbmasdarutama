"use client";

import { Plus, Edit, Trash2, Package, Folder } from "lucide-react";

interface SubCategory {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  _count: {
    products: number;
  };
}

interface SubCategoryListProps {
  categoryId: string;
  categoryName: string;
  subCategories: SubCategory[];
  onAddSubCategory: (categoryId: string) => void;
  onEditSubCategory: (subCategory: SubCategory) => void;
  onDeleteSubCategory: (subCategory: SubCategory) => void;
}

export function SubCategoryList({
  categoryId,
  categoryName,
  subCategories,
  onAddSubCategory,
  onEditSubCategory,
  onDeleteSubCategory,
}: SubCategoryListProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-stone-600" />
          <h4 className="text-sm font-semibold text-stone-700">
            Sub-Kategori ({subCategories.length})
          </h4>
        </div>
        <button
          onClick={() => onAddSubCategory(categoryId)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:scale-105 bg-red-900 text-white hover:bg-red-800"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah</span>
        </button>
      </div>

      {/* List */}
      {subCategories.length === 0 ? (
        <div className="p-6 text-center rounded-xl border-2 border-dashed border-stone-200">
          <Folder className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="text-sm text-stone-600">
            Belum ada sub-kategori di <span className="font-semibold">{categoryName}</span>
          </p>
          <button
            onClick={() => onAddSubCategory(categoryId)}
            className="mt-3 text-xs text-stone-600 hover:text-stone-600 font-semibold"
          >
            + Tambah Sub-Kategori
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {subCategories.map((subCategory) => (
            <div
              key={subCategory.id}
              className="glass-card p-3 hover:bg-white/60 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="p-2 rounded-lg flex-shrink-0 bg-stone-100 border border-stone-200"
                  >
                    <Folder className="w-4 h-4 text-stone-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-semibold text-stone-900 truncate">
                      {subCategory.name}
                    </h5>
                    {subCategory.description && (
                      <p className="text-xs text-stone-600 mt-0.5 truncate">
                        {subCategory.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${
                      subCategory._count.products > 0
                        ? "bg-green-100 text-green-700"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    <Package className="w-3 h-3" />
                    <span>{subCategory._count.products}</span>
                  </span>
                  <button
                    onClick={() => onEditSubCategory(subCategory)}
                    className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit"
                  >
                    <Edit className="w-3.5 h-3.5 text-stone-600" />
                  </button>
                  <button
                    onClick={() => onDeleteSubCategory(subCategory)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-800" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
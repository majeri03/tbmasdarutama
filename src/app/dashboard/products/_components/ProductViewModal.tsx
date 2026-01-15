"use client";

import { X, Package, DollarSign, Image as ImageIcon, Calendar, User, Tag } from "lucide-react";
import { ProductStockBadge } from "./ProductStockBadge";
import { ProductUnitDisplay } from "./ProductUnitDisplay";
import { ProductImageDisplay } from "./ProductImageDisplay";

interface Category {
  id: string;
  name: string;
}

interface SubCategory {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string | null;
}

interface Unit {
  id: string;
  name: string;
}

interface ProductUnit {
  id: string;
  conversionValue: number;
  buyPrice: number;
  sellPrice: number;
  isPrimary: boolean;
  unit: Unit;
}

interface ProductImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
}

interface Product {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  currentStock: number;
  minStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: Category;
  subCategory: SubCategory | null;
  supplier: Supplier | null;
  productUnits: ProductUnit[];
  productImages: ProductImage[];
  _count: {
    productImages: number;
    saleItems: number;
    purchaseItems: number;
  };
}

interface ProductViewModalProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
}

export function ProductViewModal({ product, onClose, onEdit }: ProductViewModalProps) {
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="glass-card w-full max-w-4xl my-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
              }}
            >
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {product.code}
                </span>
                {product.barcode && (
                  <span className="text-sm text-gray-600">| {product.barcode}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="btn-primary">
              <Package className="w-4 h-4" />
              <span>Edit Produk</span>
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Stok Saat Ini</p>
                  <p className="text-xl font-bold text-gray-900">{product.currentStock}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Penjualan</p>
                  <p className="text-xl font-bold text-gray-900">{product._count.saleItems}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Tag className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Pembelian</p>
                  <p className="text-xl font-bold text-gray-900">{product._count.purchaseItems}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <ImageIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Gambar</p>
                  <p className="text-xl font-bold text-gray-900">{product._count.productImages}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Images & Basic Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Images */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                  Gambar Produk
                </h3>
                <ProductImageDisplay
                  images={product.productImages}
                  productName={product.name}
                  variant="gallery"
                />
              </div>

              {/* Units & Prices */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Satuan & Harga
                </h3>
                <ProductUnitDisplay units={product.productUnits} variant="full" />
              </div>

              {/* Description */}
              {product.description && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Deskripsi</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              {/* Status & Stock */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Status & Stok</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Status Produk</p>
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                        product.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {product.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Status Stok</p>
                    <ProductStockBadge
                      currentStock={product.currentStock}
                      minStock={product.minStock}
                      size="md"
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Stok Saat Ini</p>
                    <p className="text-2xl font-bold text-gray-900">{product.currentStock}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Minimum Stok</p>
                    <p className="text-lg font-semibold text-gray-900">{product.minStock}</p>
                  </div>
                </div>
              </div>

              {/* Category Info */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Kategori</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Kategori Utama</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {product.category.name}
                    </p>
                  </div>

                  {product.subCategory && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Sub-Kategori</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {product.subCategory.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Supplier Info */}
              {product.supplier && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600" />
                    Supplier
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600">Nama</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {product.supplier.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Kode</p>
                      <p className="text-xs font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block">
                        {product.supplier.code}
                      </p>
                    </div>
                    {product.supplier.phone && (
                      <div>
                        <p className="text-sm text-gray-600">Telepon</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {product.supplier.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  Informasi Waktu
                </h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-600">Dibuat</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(product.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Terakhir Diperbarui</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(product.updatedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
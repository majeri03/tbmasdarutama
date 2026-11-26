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
    <div className="modal-overlay overflow-y-auto">
      <div className="modal-container w-full max-w-4xl my-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1C1917]/95 backdrop-blur-sm z-10 flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{
                background: "rgba(127, 29, 29, 0.08)",
                border: "1px solid rgba(127, 29, 29, 0.2)",
              }}
            >
              <Package className="w-6 h-6 text-[#E5484D]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-stone-100">{product.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono text-stone-400 bg-white/10 px-2 py-0.5 rounded">
                  {product.code}
                </span>
                {product.barcode && (
                  <span className="text-sm text-stone-400">| {product.barcode}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="btn-primary">
              <Package className="w-4 h-4" />
              <span>Edit Produk</span>
            </button>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-300 transition-colors">
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
                <div className="p-2 rounded-xl bg-[#E5484D]/15">
                  <Package className="w-5 h-5 text-[#E5484D]" />
                </div>
                <div>
                  <p className="text-xs text-stone-400">Stok Saat Ini</p>
                  <p className="text-xl font-semibold tracking-tight text-stone-100">{product.currentStock}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-500/15">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-stone-400">Total Penjualan</p>
                  <p className="text-xl font-semibold tracking-tight text-stone-100">{product._count.saleItems}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#E5484D]/15">
                  <Tag className="w-5 h-5 text-[#E5484D]" />
                </div>
                <div>
                  <p className="text-xs text-stone-400">Total Pembelian</p>
                  <p className="text-xl font-semibold tracking-tight text-stone-100">{product._count.purchaseItems}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/15">
                  <ImageIcon className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-stone-400">Gambar</p>
                  <p className="text-xl font-semibold tracking-tight text-stone-100">{product._count.productImages}</p>
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
                <h3 className="text-lg font-bold text-stone-100 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#E5484D]" />
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
                <h3 className="text-lg font-bold text-stone-100 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Satuan & Harga
                </h3>
                <ProductUnitDisplay units={product.productUnits} variant="full" />
              </div>

              {/* Description */}
              {product.description && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-bold text-stone-100 mb-3">Deskripsi</h3>
                  <p className="text-sm text-stone-300 whitespace-pre-wrap leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              {/* Status & Stock */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-stone-100 mb-4">Status & Stok</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-stone-400 mb-2">Status Produk</p>
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${ product.isActive ? "bg-green-500/15 text-green-400" : "bg-white/10 text-stone-300" }`}
                    >
                      {product.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-stone-400 mb-2">Status Stok</p>
                    <ProductStockBadge
                      currentStock={product.currentStock}
                      minStock={product.minStock}
                      size="md"
                    />
                  </div>

                  <div>
                    <p className="text-sm text-stone-400 mb-1">Stok Saat Ini</p>
                    <p className="text-2xl font-bold text-stone-100">{product.currentStock}</p>
                  </div>

                  <div>
                    <p className="text-sm text-stone-400 mb-1">Minimum Stok</p>
                    <p className="text-lg font-semibold text-stone-100">{product.minStock}</p>
                  </div>
                </div>
              </div>

              {/* Category Info */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-stone-100 mb-4">Kategori</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-stone-400 mb-1">Kategori Utama</p>
                    <p className="text-sm font-semibold text-stone-100">
                      {product.category.name}
                    </p>
                  </div>

                  {product.subCategory && (
                    <div>
                      <p className="text-sm text-stone-400 mb-1">Sub-Kategori</p>
                      <p className="text-sm font-semibold text-stone-100">
                        {product.subCategory.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Supplier Info */}
              {product.supplier && (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-bold text-stone-100 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#E5484D]" />
                    Supplier
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-stone-400">Nama</p>
                      <p className="text-sm font-semibold text-stone-100">
                        {product.supplier.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-stone-400">Kode</p>
                      <p className="text-xs font-mono text-stone-100 bg-white/10 px-2 py-1 rounded inline-block">
                        {product.supplier.code}
                      </p>
                    </div>
                    {product.supplier.phone && (
                      <div>
                        <p className="text-sm text-stone-400">Telepon</p>
                        <p className="text-sm font-semibold text-stone-100">
                          {product.supplier.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-stone-100 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-stone-400" />
                  Informasi Waktu
                </h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-stone-400">Dibuat</p>
                    <p className="text-sm font-semibold text-stone-100">
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
                    <p className="text-sm text-stone-400">Terakhir Diperbarui</p>
                    <p className="text-sm font-semibold text-stone-100">
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
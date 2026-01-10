"use client";

import { AlertTriangle, Package, Phone, ExternalLink } from "lucide-react";
import Link from "next/link";

interface LowStockProduct {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  currentStock: number;
  minStock: number;
  category: {
    id: string;
    name: string;
  } | null;
  supplier: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
}

interface LowStockAlertProps {
  products: LowStockProduct[];
}

export function LowStockAlert({ products }: LowStockAlertProps) {
  if (products.length === 0) {
    return (
      <div className="glass-card border-2 border-green-200 bg-green-50">
        <div className="flex items-center gap-3 p-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">
              Semua Stock Aman! ✅
            </h3>
            <p className="text-sm text-green-700">
              Tidak ada produk dengan stock rendah saat ini
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card border-2 border-red-200">
      {/* Header */}
      <div className="bg-red-50 border-b border-red-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-red-900 text-lg">
                Peringatan Stock Rendah
              </h3>
              <p className="text-sm text-red-700">
                {products.length} produk perlu segera direstock
              </p>
            </div>
          </div>
          <div className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold">
            {products.length}
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {products.map((product) => {
          const stockPercentage = product.minStock > 0
            ? (product.currentStock / product.minStock) * 100
            : 0;
          
          const isOutOfStock = product.currentStock === 0;
          const isCritical = stockPercentage <= 50 && !isOutOfStock;

          return (
            <div
              key={product.id}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                isOutOfStock ? "bg-red-50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Product Info */}
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {product.name}
                        </h4>
                        {isOutOfStock && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">
                            HABIS
                          </span>
                        )}
                        {isCritical && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                            KRITIS
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <span className="font-mono">{product.code}</span>
                        {product.category && (
                          <>
                            <span>•</span>
                            <span>{product.category.name}</span>
                          </>
                        )}
                      </div>

                      {/* Stock Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Stock Progress</span>
                          <span className="font-semibold text-gray-900">
                            {product.currentStock} / {product.minStock} unit
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              isOutOfStock
                                ? "bg-red-600"
                                : stockPercentage <= 25
                                ? "bg-red-500"
                                : stockPercentage <= 50
                                ? "bg-orange-500"
                                : "bg-yellow-500"
                            }`}
                            style={{
                              width: `${Math.min(stockPercentage, 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Supplier Info */}
                      {product.supplier && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                          <span className="font-medium">Supplier:</span>
                          <span>{product.supplier.name}</span>
                          {product.supplier.phone && (
                            <>
                              <span>•</span>
                              <a
                                href={`tel:${product.supplier.phone}`}
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <Phone className="w-3 h-3" />
                                {product.supplier.phone}
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <Link
                  href={`/dashboard/products?productId=${product.id}`}
                  className="flex-shrink-0 p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                  title="Lihat Detail Produk"
                >
                  <ExternalLink className="w-5 h-5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            💡 <span className="font-medium">Tips:</span> Segera hubungi supplier untuk restock produk
          </p>
          <Link
            href="/dashboard/products"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kelola Produk
          </Link>
        </div>
      </div>
    </div>
  );
}
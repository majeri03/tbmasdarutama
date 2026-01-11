"use client";

import { POSProduct } from "@/types/pos";
import { ProductCard } from "./ProductCard";
import { Loader2, PackageX } from "lucide-react";

interface ProductGridProps {
  products: POSProduct[];
  onAddToCart: (product: POSProduct) => void;
  isLoading?: boolean;
}

export function ProductGrid({ products, onAddToCart, isLoading }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <PackageX className="w-16 h-16 mb-4" />
        <p className="text-lg font-medium">Produk tidak ditemukan</p>
        <p className="text-sm">Coba kata kunci lain atau scan barcode</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
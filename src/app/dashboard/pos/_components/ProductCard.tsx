"use client";

import { POSProduct } from "@/types/pos";
import { formatCurrency } from "@/lib/utils/pos-helpers"; // ✅ ADDED: decimalToNumber
import { Package, ShoppingCart } from "lucide-react";
import Image from "next/image";

interface ProductCardProps {
    product: POSProduct;
    onAddToCart: (product: POSProduct) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
    // Get primary unit price (for display)
    const primaryUnit = product.productUnits.find((pu) => pu.isPrimary);
    const displayPrice = primaryUnit ? primaryUnit.sellPrice : 0;

    // Get primary image
    const primaryImage = product.productImages.find((img) => img.isPrimary)?.imageUrl; // ✅ FIXED: productImages

    // Stock badge color
    const stockColor =
        product.currentStock === 0
            ? "bg-red-100 text-red-700"
            : product.currentStock <= product.minStock
                ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700";

    return (
        <div
            className="glass-card group hover:shadow-lg transition-all duration-300 cursor-pointer"
            onClick={() => onAddToCart(product)}
        >
            {/* Product Image */}
            <div className="relative h-24 md:h-40 bg-gradient-to-br from-gray-50 to-gray-100 rounded-t-lg overflow-hidden">
                {primaryImage ? (
                    <Image
                        src={primaryImage}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="w-16 h-16 text-gray-300" />
                    </div>
                )}

                {/* Stock Badge */}
                <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockColor}`}>
                        Stock: {product.currentStock}
                    </span>
                </div>
            </div>

            {/* Product Info */}
            <div className="p-2 md:p-4">
                {/* Product Name */}
                <h3 className="text-xs md:text-sm font-semibold text-gray-900 line-clamp-2 min-h-[2rem] md:min-h-[3rem]">
                    {product.name}
                </h3>

                {/* Product Code */}
                <p className="text-xs text-gray-500 mt-1">{product.code}</p>

                {/* Price & Unit */}
                <div className="mt-3 flex items-center justify-between">
                    <div>
                        <p className="text-lg font-bold text-blue-600">{formatCurrency(displayPrice)}</p>
                        {primaryUnit && (
                            <p className="text-xs text-gray-500">per {primaryUnit.unit.name}</p>
                        )}
                    </div>

                    {/* Add to Cart Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(product);
                        }}
                        disabled={product.stock <= 0}
                        className="w-full py-2 md:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1 md:gap-2"
                    >
                        <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="hidden md:inline text-sm md:text-base">Tambah</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
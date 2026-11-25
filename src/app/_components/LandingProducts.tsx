"use client";

import { Package } from "lucide-react";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  description: string | null;
  sellingPrice: number;
  imageUrl: string | null;
  category: { name: string };
  unit: { name: string };
}

interface Props {
  products: Product[];
}

export default function LandingProducts({ products }: Props) {
  return (
    <section id="products" className="py-20 relative scroll-mt-24">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M0 0h40v40H0V0zm40 40h40v40H40V40zm0-40h2l-2 2V0zm0 4l4-4h2l-6 6V4zm0 4l8-8h2L40 10V8zm0 4L52 0h2L40 14v-2zm0 4L56 0h2L40 18v-2zm0 4L60 0h2L40 22v-2zm0 4L64 0h2L40 26v-2zm0 4L68 0h2L40 30v-2zm0 4L72 0h2L40 34v-2zm0 4L76 0h2L40 38v-2zm0 4L80 0v2L42 40h-2zm4 0L80 4v2L46 40h-2zm4 0L80 8v2L50 40h-2zm4 0l28-28v2L54 40h-2zm4 0l24-24v2L58 40h-2zm4 0l20-20v2L62 40h-2zm4 0l16-16v2L66 40h-2zm4 0l12-12v2L70 40h-2zm4 0l8-8v2l-6 6h-2zm4 0l4-4v2l-2 2h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Produk <span className="text-gradient">Unggulan</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full mb-6" />
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Pilihan terbaik untuk kebutuhan bangunan Anda — harga tertera per satuan
          </p>
        </div>

        {products.length === 0 ? (
          // Section tetap dirender (dengan id="products") supaya tautan nav
          // "Produk" tidak pernah mengarah ke anchor yang tidak ada.
          <div className="glass-card max-w-xl mx-auto p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-xl text-gray-800 mb-2">
              Katalog produk segera hadir
            </h3>
            <p className="text-gray-600 mb-6">
              Produk unggulan belum tersedia saat ini. Hubungi kami untuk
              daftar harga terbaru.
            </p>
            <a href="#contact" className="btn-primary px-6 py-3">
              Hubungi Kami
            </a>
          </div>
        ) : (
          <>
            {/* Products Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product, index) => (
                <div
                  key={product.id}
                  className="glass-card overflow-hidden hover:scale-105 transition-all duration-300 animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Image */}
                  <div className="relative h-48 bg-gray-100">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-gray-400" />
                      </div>
                    )}

                    {/* Category Badge */}
                    <div className="absolute top-3 left-3 glass-card px-3 py-1">
                      <span className="text-xs font-semibold text-gray-800">
                        {product.category.name}
                      </span>
                    </div>
                  </div>

                  {/* Content: nama + deskripsi + harga */}
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-800 line-clamp-2">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                        {product.description}
                      </p>
                    )}
                    <p className="mt-3 text-lg font-bold text-blue-600">
                      {product.sellingPrice > 0
                        ? formatCurrency(product.sellingPrice)
                        : "Hubungi kami"}
                      {product.sellingPrice > 0 && (
                        <span className="text-sm font-medium text-gray-500">
                          {" "}
                          / {product.unit.name}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="text-center mt-12 animate-slide-up animation-delay-600">
              <a href="#contact" className="btn-primary px-8 py-4 text-lg">
                Hubungi Kami untuk Info Lebih Lanjut
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

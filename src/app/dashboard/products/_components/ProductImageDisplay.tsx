"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Image as ImageIcon, ZoomIn } from "lucide-react";

interface ProductImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
}

interface ProductImageDisplayProps {
  images: ProductImage[];
  productName: string;
  variant?: "thumbnail" | "gallery";
}

export function ProductImageDisplay({
  images,
  productName,
  variant = "thumbnail",
}: ProductImageDisplayProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return (
      <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300">
        <div className="text-center">
          <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500">Tidak ada gambar</p>
        </div>
      </div>
    );
  }

  const primaryImage = images.find((img) => img.isPrimary) || images[0];

  if (variant === "thumbnail") {
    return (
      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 group cursor-pointer">
        <Image
          src={primaryImage.imageUrl}
          alt={productName}
          fill
          className="object-cover"
          sizes="80px"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {images.length > 1 && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-semibold">
            +{images.length - 1}
          </div>
        )}
      </div>
    );
  }

  // Gallery variant
  return (
    <>
      <div className="space-y-3">
        {/* Primary Image */}
        <div
          className="relative w-full h-64 rounded-xl overflow-hidden bg-gray-100 cursor-pointer group"
          onClick={() => setSelectedImage(primaryImage.imageUrl)}
        >
          <Image
            src={primaryImage.imageUrl}
            alt={productName}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {primaryImage.isPrimary && (
            <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold">
              Gambar Utama
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="grid grid-cols-5 gap-2">
            {images.map((image) => (
              <div
                key={image.id}
                className={`relative h-16 rounded-lg overflow-hidden bg-gray-100 cursor-pointer group ${
                  image.id === primaryImage.id ? "ring-2 ring-blue-600" : ""
                }`}
                onClick={() => setSelectedImage(image.imageUrl)}
              >
                <Image
                  src={image.imageUrl}
                  alt={productName}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
            <Image
              src={selectedImage}
              alt={productName}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 80vw"
            />
          </div>
        </div>
      )}
    </>
  );
}
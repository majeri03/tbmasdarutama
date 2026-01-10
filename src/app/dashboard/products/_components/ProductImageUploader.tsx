"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Star, Image as ImageIcon, AlertCircle } from "lucide-react";

interface ProductImageForm {
  imageUrl: string;
  isPrimary: boolean;
}

interface ProductImageUploaderProps {
  images: ProductImageForm[];
  onChange: (images: ProductImageForm[]) => void;
  error?: string;
  maxImages?: number;
}

export function ProductImageUploader({
  images,
  onChange,
  error,
  maxImages = 5,
}: ProductImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Check max images
    if (images.length + files.length > maxImages) {
      alert(`Maksimal ${maxImages} gambar!`);
      return;
    }

    setUploading(true);

    try {
      const newImages: ProductImageForm[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (!file.type.startsWith("image/")) {
          alert(`File ${file.name} bukan gambar!`);
          continue;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          alert(`File ${file.name} terlalu besar! Maksimal 2MB.`);
          continue;
        }

        // Convert to base64 for preview (temporary)
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;

        newImages.push({
          imageUrl: base64,
          isPrimary: images.length === 0 && i === 0, // First image is primary
        });
      }

      onChange([...images, ...newImages]);
    } catch (error) {
      console.error("Error uploading images:", error);
      alert("Gagal mengupload gambar!");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDelete = (index: number) => {
    const imageToDelete = images[index];
    const remainingImages = images.filter((_, i) => i !== index);

    // If deleting primary image, make first remaining image primary
    if (imageToDelete.isPrimary && remainingImages.length > 0) {
      remainingImages[0].isPrimary = true;
    }

    onChange(remainingImages);
  };

  const handleSetPrimary = (index: number) => {
    const updatedImages = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    onChange(updatedImages);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        } ${images.length >= maxImages ? "opacity-50 pointer-events-none" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={images.length >= maxImages}
        />

        <div className="space-y-3">
          <div
            className="inline-flex p-4 rounded-full"
            style={{
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
            }}
          >
            <Upload className="w-8 h-8 text-blue-600" />
          </div>

          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || images.length >= maxImages}
              className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
            >
              {uploading ? "Mengupload..." : "Klik untuk upload"}
            </button>
            <span className="text-gray-600"> atau drag & drop</span>
          </div>

          <p className="text-sm text-gray-500">
            PNG, JPG, WEBP (max 2MB) • Maksimal {maxImages} gambar
          </p>

          <p className="text-xs text-gray-500">
            {images.length}/{maxImages} gambar terupload
          </p>
        </div>
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">
            Preview Gambar ({images.length})
          </h4>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((image, index) => (
              <div
                key={index}
                className={`relative group rounded-lg overflow-hidden border-2 ${
                  image.isPrimary ? "border-blue-500" : "border-gray-200"
                }`}
              >
                {/* Image */}
                <div className="relative aspect-square bg-gray-100">
                  <Image
                    src={image.imageUrl}
                    alt={`Preview ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>

                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(index)}
                    className={`p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 ${
                      image.isPrimary
                        ? "bg-blue-600 text-white"
                        : "bg-white/90 text-gray-700 hover:bg-white"
                    }`}
                    title={image.isPrimary ? "Gambar utama" : "Jadikan utama"}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        image.isPrimary ? "fill-current" : ""
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all opacity-0 group-hover:opacity-100"
                    title="Hapus"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Primary Badge */}
                {image.isPrimary && (
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Utama</span>
                  </div>
                )}

                {/* Index Number */}
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-white text-xs font-semibold">
                  #{index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="glass-card p-6 text-center">
          <div
            className="inline-flex p-4 rounded-full mb-3"
            style={{
              background: "rgba(156, 163, 175, 0.1)",
              border: "1px solid rgba(156, 163, 175, 0.2)",
            }}
          >
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">
            Belum Ada Gambar
          </h4>
          <p className="text-sm text-gray-600">
            Upload gambar produk untuk tampilan yang lebih menarik
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Info Box */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">💡 Tips:</span> Gambar pertama akan
          otomatis menjadi gambar utama. Anda bisa mengubahnya dengan klik icon
          bintang.
        </p>
      </div>
    </div>
  );
}
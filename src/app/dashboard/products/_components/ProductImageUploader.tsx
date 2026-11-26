"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Star, Image as ImageIcon, AlertCircle } from "lucide-react";
import { compressImageFile } from "@/lib/utils/image-compress";

interface ProductImageForm {
  imageUrl: string;
  isPrimary: boolean;
}

interface ProductImageUploaderProps {
  images: ProductImageForm[];
  onChange: (images: ProductImageForm[]) => void;
  maxImages?: number;
}

export function ProductImageUploader({
  images,
  onChange,
  maxImages = 5,
}: ProductImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string>("");

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Check max images
    if (images.length + files.length > maxImages) {
      setUploadError(`Maksimal ${maxImages} gambar!`); // ✅ USE STATE
      return;
    }

    setUploading(true);
    setUploadError(""); // ✅ CLEAR ERROR

    try {
      const newImages: ProductImageForm[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (!file.type.startsWith("image/")) {
          setUploadError(`File ${file.name} bukan gambar!`); // ✅ USE STATE
          continue;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          setUploadError(`File ${file.name} terlalu besar! Maksimal 5MB.`); // ✅ USE STATE
          continue;
        }

        // FIX (22 Nov 2026, R2): kompres dulu seperti APK (maks 900px,
        // kualitas 0.6) — sebelumnya file asli sampai 5MB diunggah mentah.
        const fileToUpload = await compressImageFile(file);

        // ✅ Upload to Cloudflare R2 via API
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("folder", "products");

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.error || `Failed to upload ${file.name}`);
        }

        const uploadResult = await uploadResponse.json();

        newImages.push({
          imageUrl: uploadResult.url,
          isPrimary: images.length === 0 && i === 0,
        });
      }

      onChange([...images, ...newImages]);
      setUploadError(""); // ✅ CLEAR ERROR ON SUCCESS
    } catch (error) {
      console.error("Error uploading images:", error);
      const errorMessage = error instanceof Error ? error.message : "Gagal mengupload gambar!";
      setUploadError(errorMessage); // ✅ USE STATE
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

    // FIX (22 Nov 2026, R2): gambar sudah terunggah ke R2 saat dipilih —
    // hapus dari form saja membuatnya yatim. Coba hapus dari R2 juga
    // (best-effort; DELETE /api/upload sekarang menerima URL penuh).
    // Kalau gagal (mis. bukan admin), file lama tetap tercatat di R2File
    // dan bisa dibersihkan dari halaman Penyimpanan.
    if (imageToDelete?.imageUrl) {
      fetch(
        `/api/upload?filename=${encodeURIComponent(imageToDelete.imageUrl)}`,
        { method: "DELETE" }
      ).catch(() => undefined);
    }

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
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive
          ? "border-[#E5484D] bg-[#E5484D]/10"
          : "border-white/15 bg-white/5 hover:bg-white/10"
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
              background: "rgba(229, 72, 77, 0.12)",
              border: "1px solid rgba(229, 72, 77, 0.35)",
            }}
          >
            <Upload className="w-8 h-8 text-[#E5484D]" />
          </div>

          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || images.length >= maxImages}
              className="text-[#E5484D] font-semibold hover:text-red-300 transition-colors"
            >
              {uploading ? "Mengupload..." : "Klik untuk upload"}
            </button>
            <span className="text-stone-400"> atau drag & drop</span>
          </div>

          <p className="text-sm text-stone-400">
            PNG, JPG, WEBP (max 2MB) • Maksimal {maxImages} gambar
          </p>

          <p className="text-xs text-stone-400">
            {images.length}/{maxImages} gambar terupload
          </p>
        </div>
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-stone-300">
            Preview Gambar ({images.length})
          </h4>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((image, index) => (
              <div
                key={index}
                className={`relative group rounded-lg overflow-hidden border-2 ${image.isPrimary ? "border-[#E5484D]" : "border-white/10"
                  }`}
              >
                {/* Image */}
                <div className="relative aspect-square bg-white/10">
                  <Image
                    src={image.imageUrl}
                    alt={`Preview ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>

                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/70 transition-colors flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(index)}
                    className={`p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 ${image.isPrimary
                      ? "bg-red-900 text-white"
                      : "bg-[#1C1917]/90 text-stone-300 hover:bg-[#1C1917]"
                      }`}
                    title={image.isPrimary ? "Gambar utama" : "Jadikan utama"}
                  >
                    <Star
                      className={`w-4 h-4 ${image.isPrimary ? "fill-current" : ""
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
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-red-900 text-white text-xs font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Utama</span>
                  </div>
                )}

                {/* Index Number */}
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/80 text-white text-xs font-semibold">
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
            <ImageIcon className="w-8 h-8 text-stone-500" />
          </div>
          <h4 className="font-semibold text-stone-100 mb-1">
            Belum Ada Gambar
          </h4>
          <p className="text-sm text-stone-400">
            Upload gambar produk untuk tampilan yang lebih menarik
          </p>
        </div>
      )}

      {/* Upload Error */}
      {/* Error Message */}
      {uploadError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 animate-slide-down">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{uploadError}</p>
          </div>
          <button
            type="button"
            onClick={() => setUploadError("")}
            className="text-red-400 hover:text-red-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="p-3 rounded-lg bg-white/10 border border-white/10">
        <p className="text-sm text-stone-300">
          <span className="font-semibold">💡 Tips:</span> Gambar pertama akan
          otomatis menjadi gambar utama. Anda bisa mengubahnya dengan klik icon
          bintang.
        </p>
      </div>
    </div>
  );
}
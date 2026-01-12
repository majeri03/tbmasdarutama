"use client";

import { useEffect, useState } from "react";
import { Upload, Trash2, GripVertical, Loader2, X, ImageIcon } from "lucide-react";
import { getLandingPageSettings, addHeroImage, deleteHeroImage, reorderHeroImages } from "@/lib/actions/landing-page.actions";
import { HeroImage } from "@/types/settings";
import { Toast, useToast } from "@/components/ui/toast";
import Image from "next/image";

interface Props {
    landingId: string;
    onUpdate: () => void;
}

export default function HeroImageManager({ landingId, onUpdate }: Props) {
    const [images, setImages] = useState<HeroImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [deleteModalId, setDeleteModalId] = useState<string | null>(null);

    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        fetchImages();
    }, [landingId]);

    const fetchImages = async () => {
        const result = await getLandingPageSettings();
        if (result.success && result.data) {
            setImages(result.data.heroImages || []);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate
        if (!file.type.startsWith("image/")) {
            showToast("File harus berupa gambar", "error");
            return;
        }

        if (file.size > 1024 * 1024) {
            showToast("Ukuran maksimal 1MB", "error");
            return;
        }

        if (images.length >= 10) {
            showToast("Maksimal 10 gambar hero", "error");
            return;
        }

        setUploading(true);

        try {
            // Upload to R2
            const formData = new FormData();
            formData.append("file", file);

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const uploadData = await uploadRes.json();

            if (!uploadData.success) {
                throw new Error(uploadData.error);
            }

            // Add to database
            const result = await addHeroImage(uploadData.url);

            if (result.success) {
                showToast("Gambar hero berhasil ditambahkan", "success");
                fetchImages();
                onUpdate();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Gagal upload gambar", "error");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await deleteHeroImage(id);

            if (result.success) {
                showToast("Gambar hero berhasil dihapus", "success");
                fetchImages();
                onUpdate();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Gagal hapus gambar", "error");
        } finally {
            setDeleteModalId(null);
        }
    };

    const handleDragStart = (id: string) => {
        setDraggingId(id);
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();

        if (!draggingId || draggingId === targetId) return;

        const dragIndex = images.findIndex((img) => img.id === draggingId);
        const targetIndex = images.findIndex((img) => img.id === targetId);

        const newImages = [...images];
        const [removed] = newImages.splice(dragIndex, 1);
        newImages.splice(targetIndex, 0, removed);

        setImages(newImages);
    };

    const handleDragEnd = async () => {
        if (!draggingId) return;

        const reorderedImages = images.map((img, index) => ({
            id: img.id,
            order: index,
        }));

        await reorderHeroImages(reorderedImages);
        setDraggingId(null);
        onUpdate();
    };

    return (
        <div className="space-y-4">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}

            {/* Upload Button */}
            <div>
                <input
                    type="file"
                    id="hero-image"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                    disabled={uploading || images.length >= 10}
                />
                <label
                    htmlFor="hero-image"
                    className={`btn-secondary inline-flex items-center gap-2 ${uploading || images.length >= 10 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                        }`}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Upload className="w-4 h-4" />
                            Upload Gambar ({images.length}/10)
                        </>
                    )}
                </label>
                <p className="text-xs text-gray-500 mt-2">
                    Format: JPG, PNG | Max: 1MB per gambar
                </p>
            </div>

            {/* Images Grid */}
            {images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                        <div
                            key={image.id}
                            draggable
                            onDragStart={() => handleDragStart(image.id)}
                            onDragOver={(e) => handleDragOver(e, image.id)}
                            onDragEnd={handleDragEnd}
                            className={`glass-card p-3 space-y-2 cursor-move group hover:shadow-lg transition-all ${draggingId === image.id ? "opacity-50" : ""
                                }`}
                        >
                            {/* Image */}
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                                <Image
                                    src={image.imageUrl}
                                    alt={`Hero ${image.order + 1}`}
                                    fill
                                    className="object-cover"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <GripVertical className="w-4 h-4" />
                                    <span>#{image.order + 1}</span>
                                </div>

                                <button
                                    onClick={() => setDeleteModalId(image.id)}
                                    className="btn-icon-danger opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Hapus gambar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-card p-8 text-center">
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Belum ada gambar hero</p>
                    <p className="text-sm text-gray-500 mt-1">Upload gambar untuk memulai</p>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalId && (
                <div className="modal-overlay">
                    <div className="modal-container max-w-md">
                        <div className="modal-header">
                            <h3 className="text-lg font-semibold text-gray-800">Hapus Gambar</h3>
                            <button
                                onClick={() => setDeleteModalId(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p className="text-gray-600">
                                Apakah Anda yakin ingin menghapus gambar ini dari hero section?
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={() => setDeleteModalId(null)}
                                className="btn-secondary"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => handleDelete(deleteModalId)}
                                className="btn-danger"
                            >
                                <Trash2 className="w-4 h-4" />
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
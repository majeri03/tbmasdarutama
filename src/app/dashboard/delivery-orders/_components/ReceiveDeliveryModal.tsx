"use client";

import { useState, useRef } from "react";
import { X, CheckCircle, Upload, Camera, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { DeliveryOrderData } from "@/types/delivery-order";
import { DeliveryStatus } from "@prisma/client";
import { updateDeliveryStatus } from "@/lib/actions/delivery-order.actions";
import { useToast } from "@/components/ui/toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface ReceiveDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deliveryOrder: DeliveryOrderData | null;
}

export function ReceiveDeliveryModal({
  isOpen,
  onClose,
  onSuccess,
  deliveryOrder,
}: ReceiveDeliveryModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<DeliveryStatus>("IN_TRANSIT");
  const [receivedBy, setReceivedBy] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [proofImage, setProofImage] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  if (!isOpen || !deliveryOrder) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("File harus berupa gambar (JPG, PNG, WebP)", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran foto maksimal 5MB", "error");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "proofs_delivery");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Gagal mengupload foto");
      }

      setProofImage(data.url);
      showToast("Foto bukti pengiriman berhasil diunggah", "success");
    } catch (err) {
      console.error("[Upload Proof Error]", err);
      showToast(err instanceof Error ? err.message : "Gagal mengunggah foto bukti", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (status === "DELIVERED" && !receivedBy) {
        showToast("Nama penerima harus diisi", "error");
        setIsLoading(false);
        return;
      }

      const result = await updateDeliveryStatus({
        id: deliveryOrder.id,
        status,
        receivedBy: status === "DELIVERED" ? receivedBy : undefined,
        receivedDate: status === "DELIVERED" ? new Date(receivedDate) : undefined,
        proofImage: proofImage || undefined,
      });

      if (result.success) {
        showToast(result.message || "Status berhasil diupdate", "success");
        onSuccess();
        onClose();
        resetForm();
      } else {
        showToast(result.error || "Gagal update status", "error");
      }
    } catch (error) {
      console.error("Error updating delivery status:", error);
      showToast("Terjadi kesalahan", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStatus("IN_TRANSIT");
    setReceivedBy("");
    setReceivedDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Update Status Pengiriman</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* DO Info */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">No. Surat Jalan:</span>
              <span className="font-semibold">{deliveryOrder.doNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Customer:</span>
              <span className="font-semibold">{deliveryOrder.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Tanggal Kirim:</span>
              <span className="text-sm">
                {format(new Date(deliveryOrder.deliveryDate), "dd MMM yyyy", {
                  locale: id,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Items:</span>
              <span className="font-semibold text-blue-600">
                {deliveryOrder.deliveryItems.length} items
              </span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status Pengiriman <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
              className="input-field"
              required
            >
              <option value="IN_TRANSIT">Dalam Pengiriman</option>
              <option value="DELIVERED">Terkirim</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>

          {/* Received Info (only for DELIVERED) */}
          {status === "DELIVERED" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diterima Oleh <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="input-field"
                  placeholder="Nama penerima"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Diterima <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              {/* Foto Bukti Pengiriman */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto Bukti Pengiriman (Opsional/Disarankan)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />

                {proofImage ? (
                  <div className="relative border border-green-200 rounded-xl p-3 bg-green-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={proofImage}
                        alt="Bukti Pengiriman"
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wider block">
                          ✓ Bukti Terunggah
                        </span>
                        <a
                          href={proofImage}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate block max-w-[220px]"
                        >
                          Lihat Foto Penuh
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProofImage("")}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Hapus foto"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl p-5 text-center cursor-pointer transition-colors"
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                        <span className="text-sm font-medium text-blue-600">
                          Mengunggah bukti pengiriman...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          Pilih / Ambil Foto Bukti Pengiriman
                        </span>
                        <span className="text-xs text-gray-500">
                          Format JPG, PNG, atau WebP (Maksimal 5MB)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Warning for Cancel */}
          {status === "CANCELLED" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Perhatian!</strong> Pengiriman akan dibatalkan dan tidak dapat diubah lagi.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                "Memproses..."
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Update Status
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
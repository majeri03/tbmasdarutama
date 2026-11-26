"use client";

import { useState, useRef, useEffect } from "react";
import { X, CheckCircle, Upload, Camera, Image as ImageIcon, Trash2, Loader2, AlertCircle } from "lucide-react";
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
  // FIX WS-H (item 118/120): sama seperti modal Edit — useToast() lokal
  // tidak dirender, jadi parent mengoper showToast-nya lewat prop ini.
  notify?: (message: string, type: "success" | "error" | "info") => void;
}

// Bukti yang tersimpan bisa berada di kolom proofImage atau sebagai tag di
// notes ([BUKTI_KIRIM]: / [FOTO_LOKASI]:) — sama seperti modal Edit.
function extractExistingProof(order: DeliveryOrderData): string {
  if (order.proofImage) return order.proofImage;
  const m1 = (order.notes || "").match(/\[BUKTI_KIRIM\]:\s*([^\s\]\n]+)/);
  if (m1 && m1[1]) return m1[1].trim();
  const m2 = (order.notes || "").match(/\[FOTO_LOKASI\]:\s*([^\s\]\n]+)/);
  if (m2 && m2[1]) return m2[1].trim();
  return "";
}

export function ReceiveDeliveryModal({
  isOpen,
  onClose,
  onSuccess,
  deliveryOrder,
  notify: notifyProp,
}: ReceiveDeliveryModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<DeliveryStatus>("IN_TRANSIT");
  const [receivedBy, setReceivedBy] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [proofImage, setProofImage] = useState<string>("");
  // FIX WS-H (item 120): bukti yang sudah tersimpan sebelumnya — dipakai
  // untuk (a) prefill foto saat modal dibuka dan (b) membedakan "tidak
  // ada foto" dari "foto dihapus user" (yang kedua harus dikirim sebagai
  // null supaya server benar-benar membersihkannya).
  const [existingProof, setExistingProof] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const notify = notifyProp ?? showToast;
  const [formError, setFormError] = useState<string>("");

  // FIX WS-H (item 120): prefill dari DO saat modal dibuka. Sebelumnya
  // modal ini TIDAK PERNAH prefill — status selalu IN_TRANSIT, nama
  // penerima & foto selalu kosong — sehingga untuk DO Terkirim user harus
  // mengetik ulang semuanya dan foto lama tidak terlihat (terasa seperti
  // "foto bukti lain tidak bisa diunggah"). DO Terkirim kini dibuka
  // dengan status DELIVERED + data terima & foto yang sudah ada.
  useEffect(() => {
    if (isOpen && deliveryOrder) {
      setFormError("");
      setStatus(deliveryOrder.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT");
      setReceivedBy(deliveryOrder.receivedBy || "");
      setReceivedDate(
        deliveryOrder.receivedDate
          ? new Date(deliveryOrder.receivedDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      const proof = extractExistingProof(deliveryOrder);
      setProofImage(proof);
      setExistingProof(proof);
    }
  }, [isOpen, deliveryOrder]);

  if (!isOpen || !deliveryOrder) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify("File harus berupa gambar (JPG, PNG, WebP)", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("Ukuran foto maksimal 5MB", "error");
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
      notify("Foto bukti pengiriman berhasil diunggah", "success");
    } catch (err) {
      console.error("[Upload Proof Error]", err);
      notify(err instanceof Error ? err.message : "Gagal mengunggah foto bukti", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError("");

    try {
      if (status === "DELIVERED" && !receivedBy) {
        const msg = "Nama penerima harus diisi";
        setFormError(msg);
        notify(msg, "error");
        setIsLoading(false);
        return;
      }

      const result = await updateDeliveryStatus({
        id: deliveryOrder.id,
        status,
        receivedBy: status === "DELIVERED" ? receivedBy : undefined,
        receivedDate: status === "DELIVERED" ? new Date(receivedDate) : undefined,
        // FIX WS-H (item 120): foto yang dihapus user harus dikirim sebagai
        // null supaya server benar-benar membersihkannya; sebelumnya selalu
        // `undefined` sehingga hapus foto tidak pernah tersimpan. Bila
        // tidak ada foto lama maupun baru, kirim undefined (tidak diubah).
        proofImage: proofImage ? proofImage : existingProof ? null : undefined,
      });

      if (result.success) {
        notify(result.message || "Status berhasil diupdate", "success");
        onSuccess();
        onClose();
        resetForm();
      } else {
        const msg = result.error || "Gagal update status";
        setFormError(msg);
        notify(msg, "error");
      }
    } catch (error) {
      console.error("Error updating delivery status:", error);
      const msg = "Terjadi kesalahan";
      setFormError(msg);
      notify(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    // Kembali ke nilai prefill DO (bukan hardcode), supaya modal siap
    // dibuka lagi untuk DO yang sama maupun DO lain.
    if (deliveryOrder) {
      setStatus(deliveryOrder.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT");
      setReceivedBy(deliveryOrder.receivedBy || "");
      setReceivedDate(
        deliveryOrder.receivedDate
          ? new Date(deliveryOrder.receivedDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      const proof = extractExistingProof(deliveryOrder);
      setProofImage(proof);
      setExistingProof(proof);
    } else {
      setStatus("IN_TRANSIT");
      setReceivedBy("");
      setReceivedDate(new Date().toISOString().split("T")[0]);
      setProofImage("");
      setExistingProof("");
    }
    setFormError("");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">Update Status Pengiriman</h2>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* DO Info */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">No. Surat Jalan:</span>
              <span className="font-semibold">{deliveryOrder.doNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">Customer:</span>
              <span className="font-semibold">{deliveryOrder.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">Tanggal Kirim:</span>
              <span className="text-sm">
                {format(new Date(deliveryOrder.deliveryDate), "dd MMM yyyy", {
                  locale: id,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-stone-600">Total Items:</span>
              <span className="font-semibold text-red-900">
                {deliveryOrder.deliveryItems.length} items
              </span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="label mb-2">
              Status Pengiriman <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
              className="input-field"
              required
            >
              {/* FIX WS-H (item 120): DO Terkirim tidak bisa mundur ke
                  IN_TRANSIT / dibatalkan (state machine server menolaknya),
                  jadi satu-satunya pilihan yang valid adalah tetap
                  Terkirim — dipakai untuk mengganti/menambah foto bukti
                  atau memperbaiki nama penerima tanpa memotong stok lagi. */}
              {deliveryOrder.status === "DELIVERED" ? (
                <option value="DELIVERED">Terkirim</option>
              ) : (
                <>
                  <option value="IN_TRANSIT">Dalam Pengiriman</option>
                  <option value="DELIVERED">Terkirim</option>
                  <option value="CANCELLED">Dibatalkan</option>
                </>
              )}
            </select>
            {deliveryOrder.status === "DELIVERED" && (
              <p className="text-xs text-stone-500 mt-1.5">
                Surat jalan ini sudah Terkirim — form ini dipakai untuk mengganti/menambah foto bukti atau memperbaiki nama penerima. Stok tidak dipotong lagi.
              </p>
            )}
          </div>

          {/* Received Info (only for DELIVERED) */}
          {status === "DELIVERED" && (
            <>
              <div>
                <label className="label mb-2">
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
                <label className="label mb-2">
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
                <label className="label mb-2">
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
                        className="w-16 h-16 object-cover rounded-xl border border-stone-200 shadow-sm"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wider block">
                          ✓ Bukti Terunggah
                        </span>
                        <a
                          href={proofImage}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-red-900 hover:underline truncate block max-w-[220px]"
                        >
                          Lihat Foto Penuh
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProofImage("")}
                      className="p-2 text-red-800 hover:bg-red-100 rounded-xl transition-colors"
                      title="Hapus foto"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 hover:border-red-900 hover:bg-red-900/5 rounded-xl p-5 text-center cursor-pointer transition-colors"
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-7 h-7 text-red-900 animate-spin" />
                        <span className="text-sm font-medium text-red-900">
                          Mengunggah bukti pengiriman...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-red-900/10 flex items-center justify-center text-red-900">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-semibold text-stone-700">
                          Pilih / Ambil Foto Bukti Pengiriman
                        </span>
                        <span className="text-xs text-stone-500">
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
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-800">
                <strong>Perhatian!</strong> Pengiriman akan dibatalkan dan tidak dapat diubah lagi.
              </p>
            </div>
          )}

          {/* Pesan galat inline (FIX WS-H): kegagalan update harus terlihat
              di dalam modal, bukan hanya lewat toast. */}
          {formError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-800 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{formError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 -mx-6 -mb-6 px-6 pb-6 bg-stone-50 border-t border-stone-200 rounded-b-3xl">
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
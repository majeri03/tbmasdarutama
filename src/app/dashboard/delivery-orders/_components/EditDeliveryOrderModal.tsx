"use client";

import { useState, useEffect, useRef } from "react";
import { X, CheckCircle, Upload, Camera, Trash2, Loader2, Calendar, User, Truck, FileText } from "lucide-react";
import { DeliveryOrderData } from "@/types/delivery-order";
import { DeliveryStatus } from "@prisma/client";
import { updateDeliveryOrder } from "@/lib/actions/delivery-order.actions";
import { useToast } from "@/components/ui/toast";

interface EditDeliveryOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deliveryOrder: DeliveryOrderData | null;
}

export function EditDeliveryOrderModal({
  isOpen,
  onClose,
  onSuccess,
  deliveryOrder,
}: EditDeliveryOrderModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [deliveryDate, setDeliveryDate] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [status, setStatus] = useState<DeliveryStatus>("PENDING");
  const [receivedBy, setReceivedBy] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [proofImage, setProofImage] = useState<string>("");

  useEffect(() => {
    if (deliveryOrder && isOpen) {
      setDeliveryDate(
        deliveryOrder.deliveryDate
          ? new Date(deliveryOrder.deliveryDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setDriver(deliveryOrder.driver || "");
      setVehicle(deliveryOrder.vehicle || "");
      setStatus(deliveryOrder.status);
      setReceivedBy(deliveryOrder.receivedBy || "");
      setReceivedDate(
        deliveryOrder.receivedDate
          ? new Date(deliveryOrder.receivedDate).toISOString().split("T")[0]
          : ""
      );

      // Bersihkan tag [BUKTI_KIRIM] / [FOTO_LOKASI] dari notes untuk form input
      const cleanNotes = (deliveryOrder.notes || "")
        .replace(/\[BUKTI_KIRIM\]:\s*[^\s\]\n]+/g, "")
        .replace(/\[FOTO_LOKASI\]:\s*[^\s\]\n]+/g, "")
        .trim();
      setNotes(cleanNotes);

      // Ambil bukti yang ada
      const existingProof =
        deliveryOrder.proofImage ||
        (() => {
          const m1 = (deliveryOrder.notes || "").match(/\[BUKTI_KIRIM\]:\s*([^\s\]\n]+)/);
          if (m1 && m1[1]) return m1[1].trim();
          const m2 = (deliveryOrder.notes || "").match(/\[FOTO_LOKASI\]:\s*([^\s\]\n]+)/);
          if (m2 && m2[1]) return m2[1].trim();
          return "";
        })();
      setProofImage(existingProof || "");
    }
  }, [deliveryOrder, isOpen]);

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
        throw new Error(data.error || "Gagal mengunggah foto");
      }

      setProofImage(data.url);
      showToast("Foto bukti pengiriman berhasil diperbarui", "success");
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
      if (status === "DELIVERED" && !receivedBy.trim()) {
        showToast("Nama penerima wajib diisi jika status Terkirim", "error");
        setIsLoading(false);
        return;
      }

      const result = await updateDeliveryOrder({
        id: deliveryOrder.id,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        driver: driver.trim() || null,
        vehicle: vehicle.trim() || null,
        status,
        receivedBy: receivedBy.trim() || null,
        receivedDate: receivedDate ? new Date(receivedDate) : null,
        notes: notes.trim() || null,
        proofImage: proofImage.trim() || null,
      });

      if (result.success) {
        showToast(result.message || "Surat Jalan berhasil diperbarui!", "success");
        onSuccess();
        onClose();
      } else {
        showToast(result.error || "Gagal memperbarui Surat Jalan", "error");
      }
    } catch (err) {
      console.error("Error editing delivery order:", err);
      showToast("Terjadi kesalahan sistem saat menyimpan perubahan", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-200" />
              Edit Surat Jalan (Admin/Superadmin)
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Nomor: <span className="font-semibold text-white">{deliveryOrder.doNumber}</span> — Customer: {deliveryOrder.customer.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Row 1: Tanggal Kirim & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Tanggal Pengiriman <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="input-field pl-10"
                  required
                />
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Status Pengiriman <span className="text-red-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
                className="input-field"
                required
              >
                <option value="PENDING">Menunggu (Pending)</option>
                <option value="IN_TRANSIT">Dalam Pengiriman (In Transit)</option>
                <option value="DELIVERED">Terkirim (Delivered)</option>
                <option value="CANCELLED">Dibatalkan (Cancelled)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Sopir & Kendaraan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Nama Pengemudi / Sopir
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  placeholder="Contoh: Pak Budi"
                  className="input-field pl-10"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Kendaraan / Plat Nomor
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="Contoh: Truck Isuzu (DD 8234 XY)"
                  className="input-field pl-10"
                />
                <Truck className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>
          </div>

          {/* Row 3: Detail Penerimaan (Aktif jika status DELIVERED) */}
          {status === "DELIVERED" && (
            <div className="p-4 bg-green-50/60 border border-green-200 rounded-xl space-y-4">
              <span className="text-xs font-bold text-green-800 uppercase tracking-wider block">
                ✓ Informasi Tanda Terima
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nama Penerima Barang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    placeholder="Nama orang yang menerima di lokasi"
                    className="input-field"
                    required={status === "DELIVERED"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tanggal Diterima
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Row 4: Foto Bukti Pengiriman */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Foto Bukti Pengiriman</span>
              <span className="text-gray-400 font-normal lowercase">Bukan foto lokasi, foto barang tiba/penerima</span>
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {proofImage ? (
              <div className="relative border border-green-200 rounded-xl p-3 bg-green-50/40 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={proofImage}
                    alt="Bukti Pengiriman"
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-green-700 block">
                      ✓ Foto Bukti Tersimpan
                    </span>
                    <a
                      href={proofImage}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate block max-w-[260px]"
                    >
                      {proofImage}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors shadow-sm"
                    disabled={isUploading}
                  >
                    Ganti Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setProofImage("")}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Hapus foto bukti"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
                      Mengunggah foto bukti pengiriman...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-1">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      Upload / Ganti Foto Bukti Pengiriman
                    </span>
                    <span className="text-xs text-gray-500">
                      Format JPG, PNG, atau WebP (Maksimal 5MB)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 5: Catatan */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Catatan / Instruksi Pengiriman
            </label>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan untuk surat jalan ini..."
                rows={3}
                className="input-field py-2"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isLoading || isUploading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={isLoading || isUploading}
            >
              {isLoading ? (
                "Menyimpan..."
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

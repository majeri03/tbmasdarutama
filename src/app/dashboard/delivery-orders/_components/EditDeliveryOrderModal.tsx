"use client";

import { useState, useEffect, useRef } from "react";
import { X, CheckCircle, Upload, Camera, Trash2, Loader2, Calendar, User, Truck, FileText, MapPin, AlertCircle } from "lucide-react";
import { DeliveryOrderData } from "@/types/delivery-order";
import { updateDeliveryOrder } from "@/lib/actions/delivery-order.actions";
import { updateCustomer } from "@/lib/actions/customer.actions";
import { getFleetVehicles, FleetVehicleOption } from "@/lib/actions/fleet.actions";
import { useToast } from "@/components/ui/toast";

interface EditDeliveryOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deliveryOrder: DeliveryOrderData | null;
  // FIX WS-H (25 Nov 2026, batch 4 item 118): useToast() menyimpan state
  // LOKAL, bukan context — showToast yang dipanggil dari dalam modal ini
  // tidak pernah dirender (yang dirender hanya Toast milik
  // DeliveryOrderClient). Itu sebabnya simpan yang gagal tampil "tanpa
  // toast". Parent wajib mengoper showToast-nya lewat prop ini supaya
  // pesan sukses/gagal benar-benar tampil. Fallback ke showToast lokal
  // hanya bila prop tidak dioper.
  notify?: (message: string, type: "success" | "error" | "info") => void;
}

export function EditDeliveryOrderModal({
  isOpen,
  onClose,
  onSuccess,
  deliveryOrder,
  notify: notifyProp,
}: EditDeliveryOrderModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fleetList, setFleetList] = useState<FleetVehicleOption[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const notify = notifyProp ?? showToast;
  // FIX WS-H (item 118): pesan galat inline di dalam modal, supaya
  // kegagalan simpan SELALU terlihat — tidak lagi bergantung pada toast.
  const [formError, setFormError] = useState<string>("");

  const [deliveryDate, setDeliveryDate] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [proofImage, setProofImage] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      getFleetVehicles().then((res) => {
        if (res.success && res.data) {
          setFleetList(res.data);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (deliveryOrder && isOpen) {
      setFormError("");
      setDeliveryDate(
        deliveryOrder.deliveryDate
          ? new Date(deliveryOrder.deliveryDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setDriver(deliveryOrder.driver || "");
      setVehicle(deliveryOrder.vehicle || "");
      // FIX WS-H (item 118): kolom alamat — diisi dari alamat customer
      // (model DeliveryOrder tidak punya kolom alamat sendiri; alamat yang
      // tampil di detail & cetak DO adalah customer.address).
      setAddress(deliveryOrder.customer.address || "");

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

  const handleDriverSelect = (driverName: string) => {
    setDriver(driverName);
    if (driverName) {
      const match = fleetList.find(
        (f) => f.driverName.toLowerCase().trim() === driverName.toLowerCase().trim()
      );
      if (match && match.plateNumber) {
        const vehicleDesc = match.brand
          ? `${match.plateNumber} (${match.brand})`
          : match.plateNumber;
        setVehicle(vehicleDesc);
      }
    }
  };

  const handleVehicleSelect = (plateVal: string) => {
    setVehicle(plateVal);
    if (plateVal) {
      const match = fleetList.find((f) => {
        const desc = f.brand ? `${f.plateNumber} (${f.brand})` : f.plateNumber;
        return f.plateNumber === plateVal || desc === plateVal;
      });
      if (match && match.driverName && !driver) {
        setDriver(match.driverName);
      }
    }
  };

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
        throw new Error(data.error || "Gagal mengunggah foto");
      }

      setProofImage(data.url);
      notify("Foto bukti pengiriman berhasil diperbarui", "success");
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

    // FIX WS-H (25 Nov 2026, batch 4 item 118) — AKAR MASALAH SIMPAN MATI:
    // modal ini dulu SELALU mengirim `status` (+ `receivedBy` /
    // `receivedDate` saat Terkirim), sementara server `updateDeliveryOrder`
    // menolak mentah-mentah request apa pun yang membawa field-field itu
    // (guard M-13: status hanya boleh lewat Ubah Status, ada efek stoknya).
    // Akibatnya SETIAP klik Simpan pasti gagal — dan karena toast dari
    // useToast() lokal di modal ini tidak pernah dirender, kegagalan itu
    // tampil "tanpa toast, modal tetap terbuka". Perbaikan: modal Edit
    // TIDAK LAGI mengirim status / tanda terima sama sekali (pengubahan
    // status & tanda terima hanya lewat modal Update Status), sehingga
    // payload-nya lolos guard server. Field status & tanda terima dihapus
    // dari form ini; DO Terkirim tetap bisa diedit metadata/fotonya
    // (guard server untuk DELIVERED ikut dilonggarkan).
    try {
      // Alamat pengiriman = alamat customer (DO tidak punya kolom alamat
      // sendiri). Simpan dulu; kalau gagal, batalkan sebelum DO diubah.
      const trimmedAddress = address.trim();
      if (trimmedAddress !== (deliveryOrder.customer.address || "")) {
        const addrResult = await updateCustomer(deliveryOrder.customerId, {
          address: trimmedAddress || "",
        });
        if (!addrResult.success) {
          const msg = addrResult.error || "Gagal memperbarui alamat customer";
          setFormError(msg);
          notify(msg, "error");
          setIsLoading(false);
          return;
        }
      }

      const result = await updateDeliveryOrder({
        id: deliveryOrder.id,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        driver: driver.trim() || null,
        vehicle: vehicle.trim() || null,
        notes: notes.trim() || null,
        // proofImage null = hapus foto bukti (kolom dibersihkan server dan
        // file lama di R2 ikut dihapus). Sebelum perbaikan 118, hapus foto
        // hanya mengosongkan form lokal karena simpan selalu gagal.
        proofImage: proofImage.trim() || null,
      });

      if (result.success) {
        notify(result.message || "Surat Jalan berhasil diperbarui!", "success");
        onSuccess();
        onClose();
      } else {
        const msg = result.error || "Gagal memperbarui Surat Jalan";
        setFormError(msg);
        notify(msg, "error");
      }
    } catch (err) {
      console.error("Error editing delivery order:", err);
      const msg = "Terjadi kesalahan sistem saat menyimpan perubahan";
      setFormError(msg);
      notify(msg, "error");
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
          {/* FIX WS-H (item 118): dropdown Status & bagian Tanda Terima
              DIHAPUS dari modal Edit — status/tanda terima hanya boleh
              diubah lewat modal Update Status (ada efek stok & guard
              server M-13 yang menolaknya di sini). Mengirimnya dari form
              ini adalah yang membuat tombol Simpan selalu gagal. */}
          {/* Row 1: Tanggal Kirim */}
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

          {/* Row 2: Sopir & Kendaraan (Fitur Armada) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Pengemudi / Sopir (Fitur Armada)
              </label>
              <div className="relative">
                <select
                  value={driver}
                  onChange={(e) => handleDriverSelect(e.target.value)}
                  className="input-field pl-10"
                >
                  <option value="">-- Pilih Sopir dari Armada --</option>
                  {driver && !fleetList.some((f) => f.driverName === driver) && (
                    <option value={driver}>{driver} (Tersimpan)</option>
                  )}
                  {Array.from(new Set(fleetList.map((f) => f.driverName).filter(Boolean))).map(
                    (dName) => {
                      const match = fleetList.find((f) => f.driverName === dName);
                      return (
                        <option key={dName} value={dName}>
                          {dName} {match ? `(${match.plateNumber}${match.brand ? ` - ${match.brand}` : ""})` : ""}
                        </option>
                      );
                    }
                  )}
                </select>
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Kendaraan / Plat Nomor (Fitur Armada)
              </label>
              <div className="relative">
                <select
                  value={vehicle}
                  onChange={(e) => handleVehicleSelect(e.target.value)}
                  className="input-field pl-10"
                >
                  <option value="">-- Pilih Kendaraan dari Armada --</option>
                  {vehicle && !fleetList.some((f) => f.plateNumber === vehicle || `${f.plateNumber} (${f.brand})` === vehicle) && (
                    <option value={vehicle}>{vehicle} (Tersimpan)</option>
                  )}
                  {fleetList.map((f) => {
                    const desc = f.brand ? `${f.plateNumber} (${f.brand})` : f.plateNumber;
                    return (
                      <option key={f.id} value={desc}>
                        {desc} — Sopir: {f.driverName || "-"}
                      </option>
                    );
                  })}
                </select>
                <Truck className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>
          </div>

          {/* Row 3: Alamat Pengiriman (FIX WS-H item 118 — sebelumnya tidak
              ada kolom alamat di form edit; alamat yang tampil di detail &
              cetak DO adalah alamat customer, jadi field ini mengubah
              alamat customer tersebut). */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Alamat Pengiriman
            </label>
            <div className="relative">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat tujuan pengiriman"
                rows={2}
                maxLength={255}
                className="input-field py-2 pl-10"
              />
              <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Alamat customer — perubahan di sini juga mengubah alamat customer di data master.
            </p>
          </div>

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

          {/* Pesan galat inline (FIX WS-H item 118): kegagalan simpan harus
              terlihat di dalam modal, bukan hanya lewat toast. */}
          {formError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{formError}</p>
            </div>
          )}

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

"use client";

import { useState } from "react";
import { createCustomer } from "@/lib/actions/customer.actions";
import { X, Loader2 } from "lucide-react";
import { CustomerType, type Customer } from "@prisma/client";

interface QuickAddCustomerProps {
    isOpen: boolean;
    onClose: () => void;
    // BUG #28 (batch 1b): sebelumnya callback ini menerima string dan
    // dipanggil dengan literal "reload" — bukan id customer baru — sehingga
    // parent tidak bisa memilih customer yang baru dibuat. Sekarang
    // customer yang baru dibuat (record lengkap dari createCustomer)
    // dikembalikan supaya parent langsung menjadikannya customer terpilih.
    onSuccess: (customer: Customer) => void;
    showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export function QuickAddCustomer({ isOpen, onClose, onSuccess, showToast }: QuickAddCustomerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<{
        name: string;
        phone: string;
        type: CustomerType;
    }>({
        name: "",
        phone: "",
        type: "REGULER",
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await createCustomer({
                name: formData.name,
                type: formData.type,
                phone: formData.phone || undefined,
            });

            if (result.success && result.data) {
                showToast("Customer berhasil ditambahkan!", "success");
                // Kembalikan customer yang baru dibuat ke parent supaya
                // langsung terpilih (BUG #28) — bukan sinyal "reload".
                onSuccess(result.data);
                onClose();
                setFormData({ name: "", phone: "", type: "REGULER" });
            } else {
                showToast(result.error || "Gagal menambahkan customer", "error");
            }
        } catch {
            showToast("Terjadi kesalahan", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                {/* Modal */}
                <div className="glass-card w-full max-w-md">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h2 className="text-lg font-semibold text-stone-100">Tambah Customer Cepat</h2>
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="text-stone-400 hover:text-stone-200"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-stone-300 mb-1">
                                Nama Customer <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                disabled={isLoading}
                                placeholder="Masukkan nama customer"
                                className="w-full px-3 py-2 border border-white/15 bg-white/[0.06] text-stone-100 placeholder:text-stone-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E5484D]"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-stone-300 mb-1">
                                No. Telepon
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                disabled={isLoading}
                                placeholder="08xxxxxxxxxx"
                                className="w-full px-3 py-2 border border-white/15 bg-white/[0.06] text-stone-100 placeholder:text-stone-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E5484D]"
                            />
                        </div>

                        {/* Type */}
                        <div>
                            <label className="block text-sm font-medium text-stone-300 mb-1">
                                Tipe Customer <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomerType })}
                                disabled={isLoading}
                                className="w-full px-3 py-2 border border-white/15 bg-white/[0.06] text-stone-100 placeholder:text-stone-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E5484D]"
                            >
                                <option value="REGULER">Regular (Diskon 0%)</option>
                                <option value="GROSIR">Grosir (Diskon 5%)</option>
                                <option value="PROYEK">Proyek (Diskon 10%)</option>
                            </select>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 border border-white/15 rounded-lg hover:bg-white/[0.07] text-stone-100 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || !formData.name}
                                className="flex-1 px-4 py-2 bg-[#7F1D1D] hover:bg-[#991B1B] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    "Simpan"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
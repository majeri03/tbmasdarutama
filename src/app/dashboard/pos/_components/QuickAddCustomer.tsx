"use client";

import { useState } from "react";
import { createCustomer } from "@/lib/actions/customer.actions";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { CustomerType } from "@prisma/client";

interface QuickAddCustomerProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (customerId: string) => void;
}

export function QuickAddCustomer({ isOpen, onClose, onSuccess }: QuickAddCustomerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();
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

            if (result.success) {
                showToast("Customer berhasil ditambahkan!", "success");
                // Reload customers after add (call parent reload)
                onSuccess("reload"); // Signal to reload customer list
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
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Tambah Customer Cepat</h2>
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nama Customer <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                disabled={isLoading}
                                placeholder="Masukkan nama customer"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                No. Telepon
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                disabled={isLoading}
                                placeholder="08xxxxxxxxxx"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipe Customer <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomerType })}
                                disabled={isLoading}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || !formData.name}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
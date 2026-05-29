"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, FileText, Settings2 } from "lucide-react";
import { getStoreSetting, updateStoreSetting } from "@/lib/actions/store-setting.actions";
import { StoreSettingFormData } from "@/types/settings";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";

export default function InvoiceSettingsTab() {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<StoreSettingFormData>({
        name: "",
        invoiceLayoutType: "STRUK_KECIL",
        invoicePaperSize: "58mm",
        invoiceDocumentPaperSize: "A4",
        invoiceShowHeader: true,
        invoiceShowLogo: true,
        invoiceShowCustomerInfo: true,
        invoiceShowPaymentInfo: true,
        invoiceShowSignature: true,
        invoiceShowFooter: true,
        invoiceFooterTerms: "BARANG YANG SUDAH DIBELI TIDAK DAPAT DITUKAR/DIKEMBALIKAN KECUALI ADA PERJANJIAN.",
    });

    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const result = await getStoreSetting();
        if (result.success && result.data) {
            setFormData(result.data as StoreSettingFormData);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await updateStoreSetting(formData);

            if (result.success) {
                showToast("Pengaturan invoice berhasil disimpan", "success");
                fetchData();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Gagal menyimpan pengaturan invoice", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.checked,
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}

            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-blue-600" />
                    Layout Default & Kertas
                </h3>
                <p className="text-sm text-gray-500">
                    Pengaturan ini akan digunakan secara otomatis saat Anda mencetak dari kasir POS maupun Riwayat Transaksi.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="label">Format Cetak Default</label>
                        <select
                            name="invoiceLayoutType"
                            value={formData.invoiceLayoutType || "STRUK_KECIL"}
                            onChange={handleChange}
                            className="glass-input"
                        >
                            <option value="STRUK_KECIL">Struk Kasir (Thermal)</option>
                            <option value="INVOICE_BESAR">Invoice Besar (A4)</option>
                            <option value="SURAT_JALAN">Surat Jalan Pengiriman</option>
                            <option value="FAKTUR_NCR">Faktur NCR</option>
                        </select>
                    </div>

                    <div>
                        <label className="label">
                            Lebar Thermal POS (Struk Kecil)
                        </label>
                        <input
                            type="text"
                            name="invoicePaperSize"
                            value={formData.invoicePaperSize || "58mm"}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="Contoh: 58mm, 80mm"
                        />
                    </div>
                    <div>
                        <label className="label">
                            Ukuran Kertas Dokumen (Invoice/NCR/DO)
                        </label>
                        <input
                            type="text"
                            name="invoiceDocumentPaperSize"
                            value={formData.invoiceDocumentPaperSize || "A4"}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="Contoh: A4, A5, Letter"
                        />
                    </div>
                </div>
            </div>

            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Komponen & Visibilitas Cetak
                </h3>
                <p className="text-sm text-gray-500 mb-4">Pilih bagian mana saja yang ingin ditampilkan pada struk atau invoice Anda.</p>

                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            name="invoiceShowHeader"
                            checked={formData.invoiceShowHeader ?? true}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Tampilkan Header Toko (Nama, Alamat, Telp)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            name="invoiceShowLogo"
                            checked={formData.invoiceShowLogo ?? true}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Tampilkan Logo Toko</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            name="invoiceShowCustomerInfo"
                            checked={formData.invoiceShowCustomerInfo ?? true}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Tampilkan Info Pelanggan</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            name="invoiceShowPaymentInfo"
                            checked={formData.invoiceShowPaymentInfo ?? true}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Tampilkan Info Bank / Transfer (Bila metode pembayaran Transfer)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            name="invoiceShowSignature"
                            checked={formData.invoiceShowSignature ?? true}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Tampilkan Kolom Tanda Tangan (Khusus A4)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            name="invoiceShowFooter"
                            checked={formData.invoiceShowFooter ?? true}
                            onChange={handleCheckboxChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Tampilkan Footer / Syarat Ketentuan</span>
                    </label>
                </div>
                
                {(formData.invoiceShowFooter ?? true) && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <label className="label">Teks Syarat & Ketentuan (Footer)</label>
                        <textarea
                            name="invoiceFooterTerms"
                            value={formData.invoiceFooterTerms || ""}
                            onChange={handleChange}
                            className="glass-input resize-none"
                            rows={3}
                            placeholder="Barang yang sudah dibeli tidak dapat ditukar..."
                        />
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Menyimpan...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Simpan Pengaturan Invoice
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

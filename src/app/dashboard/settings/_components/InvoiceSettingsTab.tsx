"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, FileText, Settings2 } from "lucide-react";
import { getStoreSetting, updateStoreSetting } from "@/lib/actions/store-setting.actions";
import { StoreSettingFormData } from "@/types/settings";
import { useToast } from "@/components/ui/toast";
import { Toast } from "@/components/ui/toast";

const THERMAL_PRESETS = ["58mm", "80mm", "76mm", "57mm"];
const DOCUMENT_PRESETS = ["A4", "A5", "F4", "Letter", "HVS"];

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

    // ── Thermal paper size state ──
    const [thermalMode, setThermalMode] = useState<"preset" | "custom">("preset");
    const [thermalCustomW, setThermalCustomW] = useState("58");

    // ── Document paper size state ──
    const [docMode, setDocMode] = useState<"preset" | "custom">("preset");
    const [docCustomW, setDocCustomW] = useState("210");
    const [docCustomH, setDocCustomH] = useState("297");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const result = await getStoreSetting();
        if (result.success && result.data) {
            const data = result.data as StoreSettingFormData;
            setFormData(data);

            // Detect thermal mode from saved value
            const thermal = data.invoicePaperSize || "58mm";
            if (THERMAL_PRESETS.includes(thermal)) {
                setThermalMode("preset");
            } else {
                setThermalMode("custom");
                setThermalCustomW(thermal.replace("mm", ""));
            }

            // Detect document mode from saved value
            const doc = data.invoiceDocumentPaperSize || "A4";
            if (DOCUMENT_PRESETS.includes(doc)) {
                setDocMode("preset");
            } else {
                setDocMode("custom");
                // Parse "210mm x 297mm" or "210 x 297"
                const match = doc.match(/(\d+)[^\d]+(\d+)/);
                if (match) { setDocCustomW(match[1]); setDocCustomH(match[2]); }
            }
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
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.checked }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // ── Thermal helpers ──
    const selectThermalPreset = (size: string) => {
        setFormData((prev) => ({ ...prev, invoicePaperSize: size }));
    };
    const updateThermalCustom = (w: string) => {
        setThermalCustomW(w);
        setFormData((prev) => ({ ...prev, invoicePaperSize: `${w}mm` }));
    };

    // ── Document helpers ──
    const selectDocPreset = (size: string) => {
        setFormData((prev) => ({ ...prev, invoiceDocumentPaperSize: size }));
    };
    const updateDocCustom = (w: string, h: string) => {
        setFormData((prev) => ({ ...prev, invoiceDocumentPaperSize: `${w}mm x ${h}mm` }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

            <div className="glass-card p-6 space-y-5">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-blue-600" />
                    Layout Default &amp; Kertas
                </h3>
                <p className="text-sm text-gray-500">
                    Pengaturan ini akan digunakan secara otomatis saat Anda mencetak dari kasir POS maupun Riwayat Transaksi.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                    {/* Format Cetak */}
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

                    {/* ── THERMAL PAPER SIZE ── */}
                    <div>
                        <label className="label">Lebar Thermal POS (Struk Kecil)</label>
                        <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-3 w-fit text-xs">
                            <button type="button"
                                onClick={() => { setThermalMode("preset"); selectThermalPreset(formData.invoicePaperSize || "58mm"); }}
                                className={`px-3 py-1.5 font-medium transition-colors ${thermalMode === "preset" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                            >⊞ Preset</button>
                            <button type="button"
                                onClick={() => { setThermalMode("custom"); updateThermalCustom(thermalCustomW); }}
                                className={`px-3 py-1.5 font-medium transition-colors ${thermalMode === "custom" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                            >✎ Custom mm</button>
                        </div>
                        {thermalMode === "preset" ? (
                            <div className="flex flex-wrap gap-2">
                                {THERMAL_PRESETS.map((size) => (
                                    <button key={size} type="button"
                                        onClick={() => selectThermalPreset(size)}
                                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                                            formData.invoicePaperSize === size
                                                ? "bg-blue-600 text-white border-blue-600 shadow"
                                                : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600"
                                        }`}
                                    >{size}</button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input type="number" min="30" max="300"
                                    value={thermalCustomW}
                                    onChange={(e) => updateThermalCustom(e.target.value)}
                                    className="glass-input text-center w-28"
                                    placeholder="58"
                                />
                                <span className="text-sm text-gray-500 font-medium">mm</span>
                                <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-1.5 font-mono ml-1">
                                    = {thermalCustomW || "58"}mm
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ── DOCUMENT PAPER SIZE ── */}
                    <div className="md:col-span-2">
                        <label className="label">Ukuran Kertas Dokumen (Invoice / NCR / Surat Jalan)</label>
                        <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-3 w-fit text-xs">
                            <button type="button"
                                onClick={() => { setDocMode("preset"); selectDocPreset(formData.invoiceDocumentPaperSize || "A4"); }}
                                className={`px-3 py-1.5 font-medium transition-colors ${docMode === "preset" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                            >⊞ Preset</button>
                            <button type="button"
                                onClick={() => { setDocMode("custom"); updateDocCustom(docCustomW, docCustomH); }}
                                className={`px-3 py-1.5 font-medium transition-colors ${docMode === "custom" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                            >✎ Custom mm × mm</button>
                        </div>

                        {docMode === "preset" ? (
                            <div className="flex flex-wrap gap-2">
                                {DOCUMENT_PRESETS.map((size) => (
                                    <button key={size} type="button"
                                        onClick={() => selectDocPreset(size)}
                                        className={`px-5 py-2 rounded-lg border text-sm font-semibold transition-all ${
                                            formData.invoiceDocumentPaperSize === size
                                                ? "bg-blue-600 text-white border-blue-600 shadow"
                                                : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600"
                                        }`}
                                    >{size}</button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <input type="number" min="50" max="500"
                                        value={docCustomW}
                                        onChange={(e) => { setDocCustomW(e.target.value); updateDocCustom(e.target.value, docCustomH); }}
                                        className="glass-input text-center w-24"
                                        placeholder="210"
                                    />
                                    <span className="text-sm text-gray-500">mm</span>
                                </div>
                                <span className="text-gray-400 font-bold text-xl">×</span>
                                <div className="flex items-center gap-1.5">
                                    <input type="number" min="50" max="700"
                                        value={docCustomH}
                                        onChange={(e) => { setDocCustomH(e.target.value); updateDocCustom(docCustomW, e.target.value); }}
                                        className="glass-input text-center w-24"
                                        placeholder="297"
                                    />
                                    <span className="text-sm text-gray-500">mm</span>
                                </div>
                                <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-1.5 font-mono">
                                    = {docCustomW || "210"} × {docCustomH || "297"} mm
                                </span>
                            </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                            Referensi: A4 = 210×297mm &nbsp;·&nbsp; A5 = 148×210mm &nbsp;·&nbsp; F4 = 215×330mm &nbsp;·&nbsp; Letter = 216×279mm
                        </p>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Komponen &amp; Visibilitas Cetak
                </h3>
                <p className="text-sm text-gray-500 mb-4">Pilih bagian mana saja yang ingin ditampilkan pada struk atau invoice Anda.</p>

                <div className="space-y-3">
                    {[
                        { name: "invoiceShowHeader", label: "Tampilkan Header Toko (Nama, Alamat, Telp)" },
                        { name: "invoiceShowLogo", label: "Tampilkan Logo Toko" },
                        { name: "invoiceShowCustomerInfo", label: "Tampilkan Info Pelanggan" },
                        { name: "invoiceShowPaymentInfo", label: "Tampilkan Info Bank / Transfer (Bila metode pembayaran Transfer)" },
                        { name: "invoiceShowSignature", label: "Tampilkan Kolom Tanda Tangan (Khusus A4)" },
                        { name: "invoiceShowFooter", label: "Tampilkan Footer / Syarat Ketentuan" },
                    ].map(({ name, label }) => (
                        <label key={name} className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                name={name}
                                checked={(formData[name as keyof StoreSettingFormData] as boolean) ?? true}
                                onChange={handleCheckboxChange}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                        </label>
                    ))}
                </div>

                {(formData.invoiceShowFooter ?? true) && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <label className="label">Teks Syarat &amp; Ketentuan (Footer)</label>
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
                        <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</>
                    ) : (
                        <><Save className="w-4 h-4" />Simpan Pengaturan Invoice</>
                    )}
                </button>
            </div>
        </form>
    );
}

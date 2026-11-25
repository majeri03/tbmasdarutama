"use client";

import { useEffect, useState } from "react";
import { Building2, Upload, Save, Loader2, Trash2 } from "lucide-react";
import { getStoreSetting, updateStoreSetting, clearStoreLogo } from "@/lib/actions/store-setting.actions";
import { StoreSettingFormData } from "@/types/settings";
import { useToast } from "@/components/ui/toast";
import Image from "next/image";
import { Toast } from "@/components/ui/toast";
import { compressImageFile } from "@/lib/utils/image-compress";
export default function StoreSettingsTab() {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    // FIX WS-K (25 Nov 2026, batch 6 item 153): state hapus logo.
    const [deletingLogo, setDeletingLogo] = useState(false);
    const [confirmDeleteLogo, setConfirmDeleteLogo] = useState(false);
    const [formData, setFormData] = useState<StoreSettingFormData>({
        name: "TB Masdar Utama",
        tagline: "",
        logoUrl: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        province: "",
        postalCode: "",
        website: "",
        instagram: "",
        facebook: "",
        whatsapp: "",
        taxNumber: "",
        bankName: "",
        bankAccount: "",
        bankHolder: "",
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

    const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        setUploading(true);

        try {
            // FIX (22 Nov 2026, R2): kompres seperti APK + kirim folder
            // "logos" (sebelumnya tanpa folder -> jatuh ke folder products).
            const fileToUpload = await compressImageFile(file);

            const formData = new FormData();
            formData.append("file", fileToUpload);
            formData.append("folder", "logos");

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (data.success) {
                setFormData((prev) => ({ ...prev, logoUrl: data.url }));
                showToast("Logo berhasil diupload", "success");
            } else {
                throw new Error(data.error);
            }
        } catch {
            showToast("Gagal upload logo", "error");
        } finally {
            setUploading(false);
        }
    };

    // FIX WS-K (25 Nov 2026, batch 6 item 153): tombol Hapus Logo.
    // Sebelumnya logo hanya bisa ditimpa (upload baru), tidak bisa
    // dihapus — logo tes menimpa logo asli dan tidak ada jalan kembali
    // dari UI. clearStoreLogo hanya mengosongkan logoUrl (string kosong
    // -> null di server) + menghapus file lama dari R2; logo asli
    // dikembalikan user sendiri dengan upload ulang.
    const handleDeleteLogo = async () => {
        setDeletingLogo(true);
        try {
            const result = await clearStoreLogo();
            if (result.success) {
                setFormData((prev) => ({ ...prev, logoUrl: "" }));
                setConfirmDeleteLogo(false);
                showToast(result.message || "Logo berhasil dihapus", "success");
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Gagal menghapus logo", "error");
        } finally {
            setDeletingLogo(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await updateStoreSetting(formData);

            if (result.success) {
                showToast("Data toko berhasil disimpan", "success");
                fetchData();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Gagal menyimpan data", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

            {/* Logo Upload */}
            <div className="space-y-4">
                <label className="label label-required">Logo Toko</label>
                <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div className="glass-card p-4 w-32 h-32 flex items-center justify-center">
                        {formData.logoUrl ? (
                            <Image
                                src={formData.logoUrl}
                                alt="Logo"
                                width={96}
                                height={96}
                                className="object-contain"
                            />
                        ) : (
                            <Building2 className="w-12 h-12 text-gray-400" />
                        )}
                    </div>

                    {/* Upload Button */}
                    <div className="flex-1">
                        <input
                            type="file"
                            id="logo"
                            accept="image/*"
                            onChange={handleUploadLogo}
                            className="hidden"
                        />
                        <label
                            htmlFor="logo"
                            className="btn-secondary inline-flex items-center gap-2 cursor-pointer"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Upload Logo
                                </>
                            )}
                        </label>
                        {formData.logoUrl && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setConfirmDeleteLogo(true)}
                                    disabled={uploading || deletingLogo}
                                    className="btn-secondary inline-flex items-center gap-2 cursor-pointer ml-2 !text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Hapus Logo
                                </button>
                                {confirmDeleteLogo && (
                                    <span className="inline-flex flex-wrap items-center gap-2 ml-2 text-xs">
                                        <span className="text-red-600 font-medium">Yakin hapus logo toko?</span>
                                        <button
                                            type="button"
                                            onClick={handleDeleteLogo}
                                            disabled={deletingLogo}
                                            className="px-2 py-1 rounded bg-red-600 text-white font-semibold disabled:opacity-50"
                                        >
                                            {deletingLogo ? "Menghapus..." : "Ya, hapus"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDeleteLogo(false)}
                                            disabled={deletingLogo}
                                            className="px-2 py-1 rounded border border-gray-300 text-gray-600"
                                        >
                                            Batal
                                        </button>
                                    </span>
                                )}
                            </>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                            Format: PNG, JPG, SVG | Max: 1MB
                        </p>
                    </div>
                </div>
            </div>

            {/* Informasi Dasar */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Informasi Dasar
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label label-required">Nama Toko</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="TB Masdar Utama"
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Tagline</label>
                        <input
                            type="text"
                            name="tagline"
                            value={formData.tagline || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="Distributor Bahan Bangunan Terpercaya"
                        />
                    </div>

                    <div>
                        <label className="label">Telepon</label>
                        <input
                            type="text"
                            name="phone"
                            value={formData.phone || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="0812-3456-7890"
                        />
                    </div>

                    <div>
                        <label className="label">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="info@tbmasdarutama.com"
                        />
                    </div>

                    <div>
                        <label className="label">Website</label>
                        <input
                            type="url"
                            name="website"
                            value={formData.website || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="https://tbmasdarutama.com"
                        />
                    </div>

                    <div>
                        <label className="label">WhatsApp</label>
                        <input
                            type="text"
                            name="whatsapp"
                            value={formData.whatsapp || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="6281234567890"
                        />
                    </div>
                </div>
            </div>

            {/* Alamat */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-gray-800">Alamat</h3>

                <div className="space-y-4">
                    <div>
                        <label className="label">Alamat Lengkap</label>
                        <textarea
                            name="address"
                            value={formData.address || ""}
                            onChange={handleChange}
                            className="glass-input resize-none"
                            rows={3}
                            placeholder="Jl. Contoh No. 123"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="label">Kota</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city || ""}
                                onChange={handleChange}
                                className="glass-input"
                                placeholder="Jakarta"
                            />
                        </div>

                        <div>
                            <label className="label">Provinsi</label>
                            <input
                                type="text"
                                name="province"
                                value={formData.province || ""}
                                onChange={handleChange}
                                className="glass-input"
                                placeholder="DKI Jakarta"
                            />
                        </div>

                        <div>
                            <label className="label">Kode Pos</label>
                            <input
                                type="text"
                                name="postalCode"
                                value={formData.postalCode || ""}
                                onChange={handleChange}
                                className="glass-input"
                                placeholder="12345"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Social Media */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-gray-800">Social Media</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Instagram</label>
                        <input
                            type="text"
                            name="instagram"
                            value={formData.instagram || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="@tbmasdarutama"
                        />
                    </div>

                    <div>
                        <label className="label">Facebook</label>
                        <input
                            type="text"
                            name="facebook"
                            value={formData.facebook || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="TB Masdar Utama"
                        />
                    </div>
                </div>
            </div>

            {/* Informasi Bank & Pajak */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-gray-800">Bank & Pajak</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">NPWP</label>
                        <input
                            type="text"
                            name="taxNumber"
                            value={formData.taxNumber || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="00.000.000.0-000.000"
                        />
                    </div>

                    <div>
                        <label className="label">Nama Bank</label>
                        <input
                            type="text"
                            name="bankName"
                            value={formData.bankName || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="Bank BCA"
                        />
                    </div>

                    <div>
                        <label className="label">Nomor Rekening</label>
                        <input
                            type="text"
                            name="bankAccount"
                            value={formData.bankAccount || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="1234567890"
                        />
                    </div>

                    <div>
                        <label className="label">Atas Nama</label>
                        <input
                            type="text"
                            name="bankHolder"
                            value={formData.bankHolder || ""}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="PT Masdar Utama"
                        />
                    </div>
                </div>
            </div>

            {/* Submit Button */}
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
                            Simpan Perubahan
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
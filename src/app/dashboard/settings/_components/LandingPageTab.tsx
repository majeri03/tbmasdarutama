"use client";

import { useEffect, useState } from "react";
import { Globe, Save, Loader2, Image as ImageIcon } from "lucide-react";
import { getLandingPageSettings, updateLandingPageSettings } from "@/lib/actions/landing-page.actions";
import { LandingPageSetting } from "@/types/settings";
import { useToast } from "@/components/ui/toast";
import HeroImageManager from "./HeroImageManager";
import { Toast } from "@/components/ui/toast";
export default function LandingPageTab() {
    const [loading, setLoading] = useState(false);
    const [landingId, setLandingId] = useState<string>("");
    const [formData, setFormData] = useState({
        heroTitle: "TB Masdar Utama",
        heroSubtitle: "Distributor Bahan Bangunan Terpercaya",
        aboutUs: "",
        whyChooseUs: "",
        showFeaturedProducts: true,
        contactMapUrl: "",
    });

    const { toast, showToast, hideToast } = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const result = await getLandingPageSettings();
        if (result.success && result.data) {
            const data = result.data as LandingPageSetting;
            setLandingId(data.id);
            setFormData({
                heroTitle: data.heroTitle,
                heroSubtitle: data.heroSubtitle,
                aboutUs: data.aboutUs || "",
                whyChooseUs: data.whyChooseUs || "",
                showFeaturedProducts: data.showFeaturedProducts,
                contactMapUrl: data.contactMapUrl || "",
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const result = await updateLandingPageSettings(formData);

            if (result.success) {
                showToast("Pengaturan landing page berhasil disimpan", "success");
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
        const { name, value, type } = e.target;

        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) => ({ ...prev, [name]: checked }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    return (
        <div className="space-y-6">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}

            {/* Hero Images Manager */}
            <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-800">Gambar Hero</h3>
                </div>
                <p className="text-sm text-gray-600">
                    Upload hingga 10 gambar untuk carousel hero section
                </p>
                <HeroImageManager landingId={landingId} onUpdate={fetchData} />
            </div>

            {/* General Settings Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Hero Section */}
                <div className="glass-card p-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-800">Hero Section</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="label label-required">Judul Hero</label>
                            <input
                                type="text"
                                name="heroTitle"
                                value={formData.heroTitle}
                                onChange={handleChange}
                                className="glass-input"
                                placeholder="TB Masdar Utama"
                                required
                            />
                        </div>

                        <div>
                            <label className="label label-required">Subjudul Hero</label>
                            <input
                                type="text"
                                name="heroSubtitle"
                                value={formData.heroSubtitle}
                                onChange={handleChange}
                                className="glass-input"
                                placeholder="Distributor Bahan Bangunan Terpercaya"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* About Section */}
                <div className="glass-card p-6 space-y-4">
                    <h3 className="font-semibold text-gray-800">Tentang Kami</h3>

                    <div>
                        <label className="label">Deskripsi Tentang Kami</label>
                        <textarea
                            name="aboutUs"
                            value={formData.aboutUs}
                            onChange={handleChange}
                            className="glass-input resize-none"
                            rows={5}
                            placeholder="Ceritakan tentang toko Anda..."
                        />
                    </div>

                    <div>
                        <label className="label">Mengapa Memilih Kami</label>
                        <textarea
                            name="whyChooseUs"
                            value={formData.whyChooseUs}
                            onChange={handleChange}
                            className="glass-input resize-none"
                            rows={5}
                            placeholder="Keunggulan toko Anda..."
                        />
                    </div>
                </div>

                {/* Features */}
                <div className="glass-card p-6 space-y-4">
                    <h3 className="font-semibold text-gray-800">Fitur Tampilan</h3>

                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            name="showFeaturedProducts"
                            checked={formData.showFeaturedProducts}
                            onChange={handleChange}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <div>
                            <p className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                                Tampilkan Produk Unggulan
                            </p>
                            <p className="text-xs text-gray-500">
                                Produk unggulan akan ditampilkan di homepage
                            </p>
                        </div>
                    </label>
                </div>

                {/* Contact Map */}
                <div className="glass-card p-6 space-y-4">
                    <h3 className="font-semibold text-gray-800">Lokasi Toko</h3>

                    <div>
                        <label className="label">Google Maps Embed URL</label>
                        <input
                            type="url"
                            name="contactMapUrl"
                            value={formData.contactMapUrl}
                            onChange={handleChange}
                            className="glass-input"
                            placeholder="https://www.google.com/maps/embed?pb=..."
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Dapatkan embed URL dari Google Maps → Share → Embed a map
                        </p>
                    </div>

                    {formData.contactMapUrl && (
                        <div className="glass-card p-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                            <iframe
                                src={formData.contactMapUrl}
                                width="100%"
                                height="300"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="rounded-lg"
                            />
                        </div>
                    )}
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
        </div>
    );
}
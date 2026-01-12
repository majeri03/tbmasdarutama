"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Loader2, Shield } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { changePassword } from "@/lib/actions/password-reset.actions";
import { Toast } from "@/components/ui/toast";
export default function PasswordSettingsTab() {
    const [loading, setLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [formData, setFormData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    const { toast, showToast, hideToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (formData.newPassword.length < 6) {
            showToast("Password baru minimal 6 karakter", "error");
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            showToast("Password tidak cocok", "error");
            return;
        }

        setLoading(true);

        try {
            const result = await changePassword(formData);

            if (result.success) {
                showToast(result.message || "Password berhasil diubah", "success");

                // Reset form
                setFormData({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Gagal mengubah password", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}

            {/* Info Card */}
            <div className="glass-card p-6 bg-blue-50/50">
                <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-blue-900">Keamanan Akun</h3>
                        <p className="text-sm text-blue-700 mt-1">
                            Gunakan password yang kuat dengan kombinasi huruf besar, huruf kecil, angka, dan simbol.
                            Minimal 6 karakter.
                        </p>
                    </div>
                </div>
            </div>

            {/* Password Form */}
            <div className="glass-card p-6 space-y-6">
                {/* Current Password */}
                <div>
                    <label className="label label-required">Password Saat Ini</label>
                    <div className="relative">
                        <input
                            type={showCurrent ? "text" : "password"}
                            name="currentPassword"
                            value={formData.currentPassword}
                            onChange={handleChange}
                            className="glass-input pr-12"
                            placeholder="Masukkan password lama"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                            {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* New Password */}
                <div>
                    <label className="label label-required">Password Baru</label>
                    <div className="relative">
                        <input
                            type={showNew ? "text" : "password"}
                            name="newPassword"
                            value={formData.newPassword}
                            onChange={handleChange}
                            className="glass-input pr-12"
                            placeholder="Masukkan password baru"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                            {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    {formData.newPassword && formData.newPassword.length < 6 && (
                        <p className="text-xs text-red-500 mt-1">Password minimal 6 karakter</p>
                    )}
                </div>

                {/* Confirm Password */}
                <div>
                    <label className="label label-required">Konfirmasi Password Baru</label>
                    <div className="relative">
                        <input
                            type={showConfirm ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="glass-input pr-12"
                            placeholder="Ulangi password baru"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                            {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
                    )}
                </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Mengubah Password...
                        </>
                    ) : (
                        <>
                            <Lock className="w-4 h-4" />
                            Ubah Password
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
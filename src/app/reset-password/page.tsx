"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, CheckCircle } from "lucide-react";
import { resetPassword } from "@/lib/actions/password-reset.actions";
import PasswordChecklist from "@/components/ui/password-checklist";
import {
  PASSWORD_ERROR_MESSAGE,
  isStrongPassword,
} from "@/lib/utils/password";
import { useToast, Toast } from "@/components/ui/toast";
import Link from "next/link";
import TurnstileWidget from "@/components/TurnstileWidget";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // HARDENING (24 Nov 2026): token Turnstile dari widget (fail open kalau
  // Turnstile belum dipasang).
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (!token) {
      showToast("Token tidak valid", "error");
      setTimeout(() => router.push("/login"), 2000);
    }
  }, [router, showToast, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Blokir client-side kalau ada aturan password yang belum lolos —
    // server tetap menolaknya juga (lihat resetPassword di
    // password-reset.actions.ts), jadi client tidak bisa bypass.
    if (!isStrongPassword(formData.newPassword)) {
      showToast(PASSWORD_ERROR_MESSAGE, "error");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      showToast("Password tidak cocok", "error");
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(token!, formData.newPassword, turnstileToken ?? undefined);

      if (result.success) {
        setSuccess(true);
        showToast("Password berhasil direset", "success");
        setTimeout(() => router.push("/login"), 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal reset password",
        "error"
      );
    } finally {
      setLoading(false);
      setTurnstileReset((n) => n + 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1C1917] mb-2">
            Password Berhasil Direset!
          </h2>
          <p className="text-stone-600 mb-6">
            Anda akan diarahkan ke halaman login...
          </p>
          <Link href="/login" className="btn-primary inline-flex">
            Login Sekarang
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      <div className="glass-card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#7F1D1D] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917]">Reset Password</h1>
          <p className="text-stone-600 mt-2">Masukkan password baru Anda</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password */}
          <div>
            <label className="label label-required">Password Baru</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="glass-input pr-12"
                placeholder="Min. 8 karakter, huruf besar, angka & simbol"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {formData.newPassword && (
              <PasswordChecklist password={formData.newPassword} />
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="label label-required">Konfirmasi Password</label>
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
                {showConfirm ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {formData.confirmPassword &&
              formData.newPassword !== formData.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
              )}
          </div>

          {/* HARDENING (24 Nov 2026): widget bot check Turnstile — hanya
              tampil kalau site key sudah diisi; kalau belum, tidak ada
              apa-apa dan form tetap jalan (fail open). */}
          <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />

          {/* Submit Button */}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Reset Password
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-stone-600 hover:text-[#7F1D1D] font-medium"
          >
            ← Kembali ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
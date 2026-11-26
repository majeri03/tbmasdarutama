"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, CheckCircle, Send } from "lucide-react";
import { verifyEmailOtp, resendVerificationOtp } from "@/lib/actions/email-verification.actions";
import { useToast, Toast } from "@/components/ui/toast";
import Link from "next/link";
import TurnstileWidget from "@/components/TurnstileWidget";

// PKG-I (23 Nov 2026, OTP verifikasi email akun baru): halaman publik
// tempat pemilik akun baru memasukkan kode OTP 6 digit yang dikirim ke
// emailnya. Meniru pola /reset-password (Suspense + server action).
// Setelah berhasil, akun langsung aktif dan bisa login.

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email") || "";

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState(prefilledEmail);
  const [otp, setOtp] = useState("");
  // HARDENING (24 Nov 2026): token Turnstile dari widget (fail open kalau
  // Turnstile belum dipasang).
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);

  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      showToast("Email wajib diisi", "error");
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      showToast("Kode verifikasi harus 6 digit angka", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyEmailOtp(email.trim(), otp.trim(), turnstileToken ?? undefined);
      if (result.success) {
        setSuccess(true);
        showToast(result.message || "Email berhasil diverifikasi", "success");
        setTimeout(() => router.push("/login"), 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal memverifikasi email",
        "error"
      );
    } finally {
      setLoading(false);
      setTurnstileReset((n) => n + 1);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      showToast("Isi dulu email Anda, baru minta kirim ulang kode", "error");
      return;
    }
    setResending(true);
    try {
      const result = await resendVerificationOtp(email.trim(), turnstileToken ?? undefined);
      if (result.success) {
        showToast(result.message || "Kode baru dikirim", "success");
        setResendCooldown(60);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal mengirim ulang kode",
        "error"
      );
    } finally {
      setResending(false);
      setTurnstileReset((n) => n + 1);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#141210]">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-100 mb-2">
            Email Terverifikasi!
          </h2>
          <p className="text-stone-400 mb-6">
            Akun Anda sudah aktif. Anda akan diarahkan ke halaman login...
          </p>
          <Link href="/login" className="btn-primary inline-flex">
            Login Sekarang
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#141210]">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      <div className="glass-card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#7F1D1D] flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-100">Verifikasi Email</h1>
          <p className="text-stone-400 mt-2">
            Masukkan kode 6 digit yang dikirim ke email Anda. Kode berlaku 15 menit.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="label label-required">Email akun</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
              placeholder="email@contoh.com"
              required
            />
          </div>

          <div>
            <label className="label label-required">Kode verifikasi (6 digit)</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="glass-input text-center text-2xl font-bold tracking-[0.5em]"
              placeholder="••••••"
              maxLength={6}
              required
            />
          </div>

          {/* HARDENING (24 Nov 2026): widget bot check Turnstile — hanya
              tampil kalau site key sudah diisi; kalau belum, tidak ada
              apa-apa dan form tetap jalan (fail open). Dipakai verifikasi
              dan kirim ulang OTP. */}
          <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Verifikasi Email Saya
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            className="text-sm text-[#E5484D] hover:text-[#F87171] font-medium inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {resendCooldown > 0
              ? `Kirim ulang kode (${resendCooldown} dtk)`
              : "Belum menerima kode? Kirim ulang"}
          </button>
          <div>
            <Link
              href="/login"
              className="text-sm text-stone-400 hover:text-[#E5484D] font-medium"
            >
              ← Kembali ke Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}

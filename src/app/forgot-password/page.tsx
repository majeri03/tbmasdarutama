"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast, Toast } from "@/components/ui/toast";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // HARDENING (24 Nov 2026): token Turnstile dari widget (fail open kalau
  // Turnstile belum dipasang).
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);

  const { toast, showToast, hideToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/settings/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: turnstileToken ?? undefined }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        showToast("Link reset password telah dikirim ke email Anda", "success");
      } else {
        throw new Error(data.error || "Gagal mengirim email");
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gagal mengirim email",
        "error"
      );
    } finally {
      setLoading(false);
      setTurnstileReset((n) => n + 1);
    }
  };

  // Success State
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-[#141210]">
        {/* Success Card */}
        <div className="glass-card rounded-[24px] p-8 max-w-md w-full text-center relative z-10 animate-slide-up">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-100 mb-2">
            Email Terkirim!
          </h2>
          <p className="text-stone-400 mb-4">
            Kami telah mengirim link reset password ke:
          </p>
          <p className="font-semibold text-[#E5484D] mb-6">{email}</p>
          <div className="glass-card bg-[#7F1D1D]/25 p-4 mb-6 text-sm text-stone-400">
            <p className="mb-2">📧 Silakan cek inbox atau folder spam Anda</p>
            <p>🔗 Link reset password berlaku selama 1 jam</p>
          </div>
          <Link href="/login" className="btn-primary inline-flex w-full justify-center">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  // Form State
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-[#141210]">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      {/* Form Card */}
      <div className="glass-card rounded-[24px] p-8 max-w-md w-full relative z-10 animate-slide-up">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#7F1D1D] flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-100 mb-2">
            Lupa Password?
          </h1>
          <p className="text-stone-400">
            Masukkan email Anda dan kami akan mengirim link untuk reset password
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="label label-required">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input pl-10"
                placeholder="admin@tbmasdarutama.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* HARDENING (24 Nov 2026): widget bot check Turnstile — hanya
              tampil kalau site key sudah diisi; kalau belum, tidak ada
              apa-apa dan form tetap jalan (fail open). */}
          <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5" />
                Kirim Link Reset Password
              </>
            )}
          </button>
        </form>

        {/* Back to Login */}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-stone-400 hover:text-[#E5484D] hover:underline transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Login
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-stone-500">
          © {new Date().getFullYear()} TB Masdar Utama. All rights reserved.
        </div>
      </div>
    </div>
  );
}
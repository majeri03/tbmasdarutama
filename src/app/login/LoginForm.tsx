"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Store, Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link"; // ✅ ADD THIS IMPORT
import { useToast, Toast } from "@/components/ui/toast";
import Image from "next/image";
import TurnstileWidget from "@/components/TurnstileWidget";
export default function LoginForm({ logoUrl }: { logoUrl?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // FIX (24 Nov 2026, OTP): true kalau login gagal karena akun belum
  // terverifikasi — tampilkan tombol ke /verify-email (lihat bawah).
  const [isUnverified, setIsUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  // HARDENING (24 Nov 2026): token Turnstile dari widget. Kalau Turnstile
  // belum dipasang (belum ada site key), widget tidak tampil dan token
  // tetap null — server melewati cek (fail open).
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);

  // Link verifikasi dengan email sudah terisi (dipakai tombol OTP +
  // link "Belum terima kode?" di bawah).
  const verifyHref = email.trim()
    ? `/verify-email?email=${encodeURIComponent(email.trim())}`
    : "/verify-email";

  const { toast, showToast, hideToast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsUnverified(false);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        turnstileToken: turnstileToken ?? undefined,
      });

      if (result?.error) {
        // HARDENING (24 Nov 2026): authorize melempar kode "turnstile"
        // kalau cek bot gagal (pola yang sama seperti "unverified").
        if (result.code === "turnstile") {
          setError("Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.");
          showToast("Verifikasi keamanan gagal", "error");
        } else if (result.code === "locked") {
          // WS-1 (26 Nov 2026, perbaikan APK ke-2): akun terkunci karena
          // terlalu banyak percobaan login (5x gagal per IP+email atau
          // 30x per IP dalam 15 menit). SEBELUMNYA authorize melempar
          // Error biasa untuk kasus ini, Auth.js v5 tidak meneruskan
          // pesannya ke client, dan cabang else di bawah menampilkan
          // "Email atau password salah" — user yang sebenarnya terkunci
          // disuruh menebak passwordnya. Sekarang kodenya "locked"
          // (lihat LockedOutError di src/lib/auth.ts) dan pesan yang
          // benar tampil: tunggu 15 menit, jangan coba lagi.
          setError("Terlalu banyak percobaan login. Coba lagi 15 menit lagi.");
          showToast("Terlalu banyak percobaan login", "error");
        } else if (result.code === "unverified") {
          setIsUnverified(true);
          setError("Akun belum terverifikasi. Masukkan kode OTP 6 digit yang dikirim ke email Anda.");
          showToast("Akun belum terverifikasi", "error");
        } else {
          setError("Email atau password salah");
          showToast("Email atau password salah", "error");
        }
      } else {
        showToast("Login berhasil! Redirecting...", "success");
        setTimeout(() => {
          router.push("/dashboard");
        }, 500);
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      showToast("Terjadi kesalahan. Silakan coba lagi.", "error");
    } finally {
      setLoading(false);
      // Terbitkan token Turnstile baru untuk percobaan berikutnya.
      setTurnstileReset((n) => n + 1);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}

      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      {/* Login Card */}
      <div className="glass-card p-8 w-full max-w-md relative z-10 animate-slide-up">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-2 ">
             {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Logo"
              width={150}
              height={100}
              className="object-contain rounded-xl"
              priority
            />
          ) : (
            <Store className="w-10 h-10 text-white" />
          )}
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            TB MASDAR UTAMA
          </h1>
          <p className="text-gray-600 flex items-center justify-center gap-2">
            Sistem Manajemen Toko Bangunan
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label className="label">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input pl-10"
                placeholder="admin"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input pl-10"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="glass-card bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* FIX (24 Nov 2026, OTP): akun belum terverifikasi — tunjukkan
              JELAS ke mana memasukkan kode OTP (email sudah terisi). */}
          {isUnverified && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-center">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                Akun Anda belum terverifikasi
              </p>
              <p className="text-sm text-amber-700 mb-3">
                Kode 6 digit sudah dikirim ke email Anda. Masukkan kodenya
                untuk mengaktifkan akun, lalu login kembali.
              </p>
              <Link
                href={verifyHref}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                <Mail className="w-4 h-4" />
                Masukkan Kode OTP
              </Link>
            </div>
          )}

          {/* HARDENING (24 Nov 2026): widget bot check Turnstile — hanya
              tampil kalau site key sudah diisi; kalau belum, tidak ada
              apa-apa dan login tetap jalan (fail open). */}
          <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Store className="w-5 h-5" />
                Masuk ke Dashboard
              </>
            )}
          </button>
        </form>

        {/* ✅ TAMBAHKAN INI - Forgot Password Link */}
        <div className="mt-6 text-center space-y-3">
          <Link
            href="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors inline-flex items-center gap-1"
          >
            <Lock className="w-4 h-4" />
            Lupa Password?
          </Link>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            {/* PKG-I (23 Nov 2026, OTP): akun baru harus verifikasi email dulu.
                Link dibuat menonjol (kotak biru) supaya pemilik akun baru
                langsung menemukan tempat memasukkan kode OTP. */}
            <Link
              href={verifyHref}
              className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline transition-colors inline-flex items-center gap-1"
            >
              <Mail className="w-4 h-4" />
              Belum terima kode? Verifikasi email / masukkan kode OTP
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} TB Masdar Utama. All rights reserved.
        </div>
      </div>
    </div>
  );
}
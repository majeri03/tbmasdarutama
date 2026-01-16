"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Store, Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link"; // ✅ ADD THIS IMPORT
import { useToast, Toast } from "@/components/ui/toast";
import Image from "next/image";
export default function LoginForm({ logoUrl }: { logoUrl?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { toast, showToast, hideToast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError("Email atau password salah");
        showToast("Email atau password salah", "error");
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
        <div className="mt-6 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors inline-flex items-center gap-1"
          >
            <Lock className="w-4 h-4" />
            Lupa Password?
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} TB Masdar Utama. All rights reserved.
        </div>
      </div>
    </div>
  );
}
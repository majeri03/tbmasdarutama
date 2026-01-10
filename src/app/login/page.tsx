"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Store, Mail, Lock, AlertCircle, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        setError(result.error);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-accent-blue/30 rounded-full mix-blend-multiply filter blur-3xl animate-glow"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-accent-purple/30 rounded-full mix-blend-multiply filter blur-3xl animate-glow animation-delay-200"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-accent-pink/25 rounded-full mix-blend-multiply filter blur-3xl animate-glow animation-delay-400"></div>
      </div>

      {/* Login Container */}
      <div className="w-full max-w-md animate-slide-up relative z-10">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-blue to-accent-purple rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-all"></div>
            <div className="relative glass-card w-full h-full flex items-center justify-center">
              <Store className="w-10 h-10 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gradient mb-2">
            TB MASDAR UTAMA
          </h1>
          <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            Sistem Manajemen Toko Bangunan
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl animate-slide-up" style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backdropFilter: 'blur(8px)'
            }}>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-700 text-sm font-semibold">Login Gagal</p>
                  <p className="text-red-600 text-xs mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@tbmasdarutama.com"
                  className="glass-input pl-12"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="glass-input pl-12"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Store className="w-5 h-5" />
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Credentials */}
        <div className="glass-card p-5 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-bold text-gray-700">Demo Account</p>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg transition-all hover:bg-blue-50/50" style={{
              background: 'rgba(96, 165, 250, 0.08)',
              border: '1px solid rgba(96, 165, 250, 0.2)'
            }}>
              <span className="text-gray-600 font-medium">Super Admin</span>
              <code className="text-blue-600 font-mono font-semibold">admin@tbmasdarutama.com</code>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg transition-all hover:bg-purple-50/50" style={{
              background: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.2)'
            }}>
              <span className="text-gray-600 font-medium">Kasir</span>
              <code className="text-purple-600 font-mono font-semibold">kasir@tbmasdarutama.com</code>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg transition-all hover:bg-pink-50/50" style={{
              background: 'rgba(244, 114, 182, 0.08)',
              border: '1px solid rgba(244, 114, 182, 0.2)'
            }}>
              <span className="text-gray-600 font-medium">Password</span>
              <code className="text-pink-600 font-mono font-semibold">admin123</code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          © 2025 TB Masdar Utama. All rights reserved.
        </p>
      </div>
    </div>
  );
}
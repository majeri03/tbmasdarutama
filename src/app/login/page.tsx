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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-accent-blue/20 rounded-full mix-blend-multiply filter blur-3xl animate-glow"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-accent-purple/20 rounded-full mix-blend-multiply filter blur-3xl animate-glow animation-delay-200"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-accent-pink/20 rounded-full mix-blend-multiply filter blur-3xl animate-glow animation-delay-400"></div>
      </div>

      {/* Login Container */}
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-blue to-accent-purple rounded-2xl blur-lg group-hover:blur-xl transition-all"></div>
            <div className="relative glass-card w-full h-full flex items-center justify-center">
              <Store className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gradient mb-2 animate-glow">
            TB MASDAR UTAMA
          </h1>
          <p className="text-gray-400 text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            Sistem Manajemen Toko Bangunan
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl backdrop-blur-sm animate-slide-up" style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-300 text-sm font-medium">Login Gagal</p>
                  <p className="text-red-400 text-xs mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
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
              <label htmlFor="password" className="block text-sm font-semibold text-gray-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
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
            <Sparkles className="w-4 h-4 text-accent-blue" />
            <p className="text-sm font-bold text-gray-300">Demo Account</p>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg" style={{
              background: 'rgba(96, 165, 250, 0.05)',
              border: '1px solid rgba(96, 165, 250, 0.1)'
            }}>
              <span className="text-gray-400">Super Admin</span>
              <code className="text-accent-blue font-mono">admin@tbmasdarutama.com</code>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{
              background: 'rgba(167, 139, 250, 0.05)',
              border: '1px solid rgba(167, 139, 250, 0.1)'
            }}>
              <span className="text-gray-400">Kasir</span>
              <code className="text-accent-purple font-mono">kasir@tbmasdarutama.com</code>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{
              background: 'rgba(244, 114, 182, 0.05)',
              border: '1px solid rgba(244, 114, 182, 0.1)'
            }}>
              <span className="text-gray-400">Password</span>
              <code className="text-accent-pink font-mono">admin123</code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          © 2025 TB Mas Darut Ama. All rights reserved.
        </p>
      </div>
    </div>
  );
}
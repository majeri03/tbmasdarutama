import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "flat-art-975br2-upload-worker.kirinxe00.workers.dev",
      },
    ],
    unoptimized: process.env.NODE_ENV === "development",
  },

  // Tambahkan CORS headers agar mobile app & API client bisa akses API, serta security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // SEMBUNYIKAN DARI GOOGLE (Nov 2026): situs ini operasional internal.
          // Header ini dibaca Google di SEMUA halaman & API — perintahnya:
          // jangan tampilkan di hasil pencarian (noindex), jangan ikuti
          // link-nya (nofollow), jangan simpan cache-nya (noarchive).
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            // Pentest fix (Nov 2026): camera=(self) — scan barcode POS web butuh
            // kamera (getUserMedia); camera=() sebelumnya mematikan fitur itu.
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "X-Permitted-Cross-Domain-Policies",
            value: "none",
          },
          {
            key: "Content-Security-Policy",
            // Pentest fix (Nov 2026): 'unsafe-eval' dihapus; tambah object-src,
            // base-uri, form-action. 'unsafe-inline' di script-src SENGAJA
            // dipertahankan — Next.js App Router butuh inline script untuk
            // hydration; menghapusnya tanpa nonce akan merusak aplikasi.
            // Lihat a-NOTES.md untuk sisa risiko ini.
            // HARDENING (24 Nov 2026): izinkan Cloudflare Turnstile
            // (https://challenges.cloudflare.com) di script-src, frame-src
            // dan connect-src — widget bot check dimuat dari sana. Tidak ada
            // origin lain yang ditambahkan; sisa CSP tidak dilonggarkan.
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://placehold.co https://flat-art-975br2-upload-worker.kirinxe00.workers.dev https://tile.openstreetmap.org; connect-src 'self' https://masdarutama.tech https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

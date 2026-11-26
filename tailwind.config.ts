import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Gray Scale — mode gelap (26 Nov 2026): arang hangat, bukan abu terang.
        "glass-dark": "#141210",
        "glass-base": "#1c1917",
        "glass-light": "#292524",
        "glass-lighter": "#44403c",

        // Accent Colors — dipetakan ulang ke palet baru (26 Nov 2026):
        // merah gelap #7F1D1D / hover #991B1B / amber hangat #B45309.
        // Nama token dipertahankan supaya class lama (mis. from-accent-blue)
        // tetap jalan, tapi warnanya sudah hangat — TIDAK ADA biru/ungu/pink.
        // accent-bright #E5484D: HANYA untuk teks kecil/link/ikon interaktif
        // di atas gelap (#7F1D1D terlalu gelap untuk teks kecil).
        "accent-blue": "#7f1d1d",
        "accent-purple": "#991b1b",
        "accent-pink": "#b45309",
        "accent-bright": "#e5484d",

        // Status Colors — redup tapi terbaca di gelap (bukan aksen)
        "status-success": "#4ade80",
        "status-warning": "#fbbf24",
        "status-danger": "#f87171",
        "status-info": "#a8a29e",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glass": "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 rgba(255, 255, 255, 0.05)",
        "glass-lg": "0 12px 48px rgba(0, 0, 0, 0.45), inset 0 2px 0 rgba(255, 255, 255, 0.14), inset 0 -2px 0 rgba(255, 255, 255, 0.06)",
        "glow": "0 0 20px rgba(229, 72, 77, 0.3)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        // Dulu gradien biru→ungu; sekarang gradien merah gelap hangat.
        "gradient-mesh": "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
      },
    },
  },
  plugins: [],
};

export default config;

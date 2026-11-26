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
        // Primary Gray Scale
        "glass-dark": "#1a1a1a",
        "glass-base": "#2a2a2a",
        "glass-light": "#3a3a3a",
        "glass-lighter": "#4a4a4a",
        
        // Accent Colors — dipetakan ulang ke palet baru (26 Nov 2026):
        // merah gelap #7F1D1D / hover #991B1B / amber hangat #B45309.
        // Nama token dipertahankan supaya class lama (mis. from-accent-blue)
        // tetap jalan, tapi warnanya sudah hangat — TIDAK ADA biru/ungu/pink.
        "accent-blue": "#7f1d1d",
        "accent-purple": "#991b1b",
        "accent-pink": "#b45309",

        // Status Colors — redup, fungsional (bukan aksen)
        "status-success": "#15803d",
        "status-warning": "#b45309",
        "status-danger": "#991b1b",
        "status-info": "#57534e",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glass": "0 8px 32px rgba(28, 25, 23, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1)",
        "glass-lg": "0 12px 48px rgba(28, 25, 23, 0.09), inset 0 2px 0 rgba(255, 255, 255, 0.6), inset 0 -2px 0 rgba(255, 255, 255, 0.15)",
        "glow": "0 0 20px rgba(127, 29, 29, 0.25)",
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
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
        
        // Accent Colors
        "accent-blue": "#60a5fa",
        "accent-purple": "#a78bfa",
        "accent-pink": "#f472b6",
        
        // Status Colors
        "status-success": "#10b981",
        "status-warning": "#f59e0b",
        "status-danger": "#ef4444",
        "status-info": "#3b82f6",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glass": "0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1)",
        "glass-lg": "0 12px 48px rgba(0, 0, 0, 0.15), inset 0 2px 0 rgba(255, 255, 255, 0.6), inset 0 -2px 0 rgba(255, 255, 255, 0.15)",
        "glow": "0 0 20px rgba(96, 165, 250, 0.3)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-mesh": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
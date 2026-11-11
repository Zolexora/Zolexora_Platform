/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: "#FFB800", light: "#FFD05C", dark: "#E5A600" },
        ink: { DEFAULT: "#111111", soft: "#222222", muted: "#555555" },
        cream: { DEFAULT: "#FAFAF8", warm: "#F4F1EB" },
        surface: "#FFFFFF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.10), 0 12px 40px rgba(0,0,0,0.08)",
        modal: "0 24px 64px rgba(0,0,0,0.18)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        shimmer: "shimmer 1.6s infinite",
      },
      keyframes: {
        fadeUp: { "0%": { opacity: 0, transform: "translateY(20px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
    },
  },
  plugins: [],
};

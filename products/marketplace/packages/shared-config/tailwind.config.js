/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [],
  theme: {
    extend: {
      colors: {
        // Brand
        gold:     { DEFAULT: "#FFB800", light: "#FFD05C", dark: "#E5A600" },
        ink:      { DEFAULT: "#1C1C1C", soft: "#2A2A2A", muted: "#4A4A4A" },
        cream:    { DEFAULT: "#FDFBF7", warm: "#F5F0E8" },
        // Semantic
        surface:  { DEFAULT: "#FFFFFF", raised: "#F9F9F9", overlay: "#F0EEE9" },
        border:   { DEFAULT: "#E8E5DF", strong: "#1C1C1C" },
        // Status
        success:  "#22C55E",
        warning:  "#F59E0B",
        error:    "#EF4444",
      },
      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        display: ["'Clash Display'", "Inter", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        neo:       "4px 4px 0 #1C1C1C",
        "neo-sm":  "2px 2px 0 #1C1C1C",
        "neo-lg":  "8px 8px 0 #1C1C1C",
        "neo-xl":  "12px 12px 0 #1C1C1C",
        "neo-gold":"4px 4px 0 #FFB800",
        glow:      "0 0 30px rgba(255,184,0,0.25)",
        "glow-lg": "0 0 60px rgba(255,184,0,0.35)",
      },
      animation: {
        "fade-up":   "fadeUp 0.4s ease forwards",
        "fade-in":   "fadeIn 0.3s ease forwards",
        "slide-up":  "slideUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards",
        "scale-in":  "scaleIn 0.3s cubic-bezier(0.22,1,0.36,1) forwards",
        "spin-slow": "spin 3s linear infinite",
        shimmer:     "shimmer 1.5s infinite",
        coin:        "coin 0.6s cubic-bezier(0.22,1,0.36,1) forwards",
      },
      keyframes: {
        fadeUp:   { "0%": { opacity: 0, transform: "translateY(16px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        fadeIn:   { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp:  { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
        scaleIn:  { "0%": { transform: "scale(0.92)", opacity: 0 }, "100%": { transform: "scale(1)", opacity: 1 } },
        shimmer:  { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        coin:     { "0%": { transform: "scale(1) translateY(0)", opacity: 1 }, "60%": { transform: "scale(1.4) translateY(-20px)", opacity: 1 }, "100%": { transform: "scale(0) translateY(-40px)", opacity: 0 } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

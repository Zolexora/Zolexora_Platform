/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: "#FFB800", dark: "#E5A600" },
        ink: { DEFAULT: "#111111", soft: "#222222", muted: "#666666" },
        surface: { DEFAULT: "#F8F8F6", card: "#FFFFFF" },
        sidebar: "#111111",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

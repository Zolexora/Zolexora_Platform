/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: "#FFB800", dark: "#E5A600" },
        ink: { DEFAULT: "#111111", soft: "#1E1E1E", muted: "#666666" },
        surface: "#F5F5F3",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

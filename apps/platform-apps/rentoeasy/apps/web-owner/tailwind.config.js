/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F3F0FF', 100: '#E9E3FF', 200: '#D3C6FF',
          300: '#B59DFF', 400: '#9575FF', 500: '#7C55F5',
          600: '#6D41E8', 700: '#5C2ECC', 800: '#4A24A6',
          900: '#3B1D85',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { modal: '0 20px 60px rgba(0,0,0,0.15)' },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#E8F5F1',100:'#C5E8DC',200:'#9DD6C3',300:'#74C4AA',
          400:'#4DB595',500:'#1D9E75',600:'#0F8A63',700:'#0F6E56',
          800:'#0B5443',900:'#073B30',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { card:'0 1px 3px rgba(0,0,0,0.06)', modal:'0 20px 60px rgba(0,0,0,0.15)' },
    },
  },
  plugins: [],
}

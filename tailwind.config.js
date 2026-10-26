/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f1',
          100: '#ffe1e1',
          200: '#ffc7c7',
          300: '#ffa0a0',
          400: '#ff6969',
          500: '#e5322d', // Red brand color similar to iLovePDF
          600: '#cc221d',
          700: '#ab1713',
          800: '#8d1613',
          900: '#751916',
          950: '#400806',
        }
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#E0E9F5',
        'white': '#FFFFFF',
        'gray-text': '#333333',
      },
      fontFamily: {
        sans: ['Inter', 'Source Han Sans', 'Noto Sans SC', 'sans-serif'],
      },
      borderRadius: {
        'card': '0.75rem',
      },
    },
  },
  plugins: [],
}
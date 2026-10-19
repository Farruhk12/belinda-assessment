/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './App.tsx', './{components,context,pages}/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#EB4420',
          secondary: '#2B3A55',
        },
      },
    },
  },
  plugins: [],
};

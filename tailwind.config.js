/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: '#5E5AA8', // Dusty Lavender
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['"DM Serif Display"', 'serif'],
      }
    },
  },
  plugins: [],
}
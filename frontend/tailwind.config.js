/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E293B',
        accent: '#3B82F6',
        background: {
          light: '#F8FAFC',
          dark: '#0F172A',
        },
        text: {
          light: '#111827',
          dark: '#E5E7EB',
        },
      },
    },
  },
  plugins: [],
}
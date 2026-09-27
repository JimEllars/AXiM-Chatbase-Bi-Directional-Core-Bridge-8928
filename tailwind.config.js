/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zinc: {
          800: '#27272a',
          900: '#18181b',
        },
        slate: {
          800: '#1e293b',
          900: '#0f172a',
        }
      }
    }
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e4ff",
          200: "#b8cbff",
          300: "#8ba7ff",
          400: "#5d7fff",
          500: "#3a5bf7",
          600: "#2742dc",
          700: "#1f33ae",
          800: "#1d2c88",
          900: "#1a276d",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.1)",
        lift: "0 10px 30px -12px rgba(16,24,40,0.25)",
      },
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

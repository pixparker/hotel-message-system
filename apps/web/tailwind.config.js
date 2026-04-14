/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette is CSS-variable driven so the theme color can be
        // switched at runtime (admin preset, future per-tenant API, etc.).
        // Defaults in styles.css match the deep hospitality teal.
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        // Warm gold accent — the "lobby brass" emphasis color
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde38a",
          300: "#fccf4d",
          400: "#f7ba24",
          500: "#e49b0f",
          600: "#c27a0a",
          700: "#9c5b0d",
          800: "#804811",
          900: "#6a3c12",
        },
        // Warm ivory surfaces — replaces cold slate washes
        surface: {
          50: "#fbfaf7",
          100: "#f6f3ee",
          200: "#ebe5d9",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(17, 24, 39, 0.04), 0 2px 6px rgba(17, 24, 39, 0.06)",
        lift: "0 12px 28px -16px rgba(17, 24, 39, 0.28), 0 4px 10px -6px rgba(17, 24, 39, 0.12)",
        glow: "0 14px 32px -14px rgb(var(--brand-600) / 0.45)",
        "inset-soft": "inset 0 1px 0 rgba(255, 255, 255, 0.12)",
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
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, rgb(var(--brand-700)) 0%, rgb(var(--brand-500)) 55%, rgb(var(--brand-300)) 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgb(var(--brand-50)) 0%, #ffffff 65%)",
        "accent-gradient":
          "linear-gradient(135deg, #c27a0a 0%, #e49b0f 50%, #f7ba24 100%)",
      },
    },
  },
  plugins: [],
};

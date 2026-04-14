/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep hospitality teal — premium, welcoming, echoes WhatsApp green
        brand: {
          50: "#ecfdf6",
          100: "#d1fae9",
          200: "#a4f1d4",
          300: "#6ee0bb",
          400: "#34c79d",
          500: "#14a77a",
          600: "#0d8a64",
          700: "#0b7052",
          800: "#0a5942",
          900: "#073d2d",
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
        glow: "0 14px 32px -14px rgba(13, 138, 100, 0.45)",
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
          "linear-gradient(135deg, #0d8a64 0%, #14a77a 55%, #34c79d 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, #ecfdf6 0%, #ffffff 65%)",
        "accent-gradient":
          "linear-gradient(135deg, #c27a0a 0%, #e49b0f 50%, #f7ba24 100%)",
      },
    },
  },
  plugins: [],
};

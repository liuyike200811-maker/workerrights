import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf4f2",
          100: "#fae3de",
          200: "#f5c9c1",
          300: "#eda79b",
          400: "#e07a6b",
          500: "#cd5244",
          600: "#b23c31",
          700: "#932f27",
          800: "#782822",
          900: "#5f211d",
          950: "#3b1411"
        },
        ink: {
          50: "#faf8f6",
          100: "#f4f0eb",
          200: "#e9e2da",
          300: "#d6cbc0",
          400: "#a2968a",
          500: "#786d63",
          600: "#5b524a",
          700: "#443d37",
          800: "#2e2925",
          900: "#1d1916"
        },
        accent: {
          50: "#fbf5e6",
          100: "#f5e9c9",
          500: "#a87d22",
          600: "#8d6719",
          700: "#715214"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(45, 25, 20, 0.04), 0 8px 24px -12px rgba(45, 25, 20, 0.12)",
        lift: "0 12px 32px -12px rgba(95, 33, 29, 0.26)"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" }
        },
        "sheet-in": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 280ms ease-out both",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        "sheet-in": "sheet-in 220ms ease-out both"
      }
    }
  },
  plugins: []
};

export default config;

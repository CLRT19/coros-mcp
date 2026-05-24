import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // COROS-style warm near-black; surfaces separated by elevation
        ink: {
          900: "#0a0b0d", // page background
          800: "#131419", // card surface
          700: "#1b1e25", // raised tile
          600: "#2a2e38", // border
          500: "#383d49", // hover border / scrollbar
        },
        // COROS brand orange — the dominant data accent
        coros: {
          DEFAULT: "#ff5a1f",
          400: "#ff7a47",
          600: "#d93c06",
        },
        recovery: {
          high: "#18c29c",
          mid: "#ffb020",
          low: "#ff4d5e",
        },
        strain: "#33b1ff",
        sleep: "#8b6dff",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

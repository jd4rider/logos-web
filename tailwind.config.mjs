/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#06111c",
        surface: "#102131",
        border: "#254259",
        text: "#f7f1e3",
        muted: "#9eb0bf",
        gold: "#f5bf52",
        accent: "#8dd6ff",
        highlight: "#183347",
        ember: "#ff8a5b",
      },
      fontFamily: {
        display: ["Fraunces", "Baskerville", "Palatino Linotype", "serif"],
        sans: ["Manrope", "Avenir Next", "Segoe UI", "sans-serif"],
        serif: ["Cormorant Garamond", "Iowan Old Style", "Baskerville", "serif"],
      },
      boxShadow: {
        panel: "0 22px 70px rgba(0, 0, 0, 0.32)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(rgba(141,214,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(141,214,255,0.06) 1px, transparent 1px)",
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        rise: "rise 700ms ease-out both",
        glow: "glow 7s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(245, 191, 82, 0)" },
          "50%": { boxShadow: "0 0 34px rgba(245, 191, 82, 0.18)" },
        },
      },
    },
  },
  plugins: [],
};

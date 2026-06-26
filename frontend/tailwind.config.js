/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        soc: {
          bg: "#0a0506",
          panel: "#13080b",
          panel2: "#1b0c11",
          elevated: "#241018",
          border: "#4a2832",
          borderSubtle: "#2e181f",
          brand: "#f43f5e",
          brand2: "#be123c",
          brand3: "#881337",
          accent: "#3da9fc",
          accent2: "#7c5cff",
          ok: "#34d399",
          warn: "#fbbf24",
          err: "#f87171",
          muted: "#b08a94",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        soc: "0 4px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(244, 63, 94, 0.07)",
        "soc-lg": "0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(244, 63, 94, 0.1)",
        sidebar: "4px 0 24px rgba(0, 0, 0, 0.35), inset -1px 0 0 rgba(244, 63, 94, 0.08)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.92)" },
        },
        modalIn: {
          from: { opacity: "0", transform: "scale(0.97) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-left": "slideInLeft 0.25s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "modal-in": "modalIn 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

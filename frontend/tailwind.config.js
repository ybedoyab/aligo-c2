/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        soc: {
          bg: "#0b0f14",
          panel: "#111823",
          panel2: "#161f2e",
          border: "#243043",
          accent: "#3da9fc",
          accent2: "#7c5cff",
          ok: "#34d399",
          warn: "#fbbf24",
          err: "#f87171",
          muted: "#7d8aa1",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

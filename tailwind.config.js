/** @type {import('tailwindcss').Config} */
// Colours resolve to the DESIGN.md tokens (CSS variables), so light/dark is a single attribute swap.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: { none: "0", sm: "6px", DEFAULT: "10px", md: "10px", lg: "14px", xl: "18px", "2xl": "22px", full: "9999px" },
    extend: {
      colors: {
        bg: v("bg"),
        raised: v("bg-raised"),
        fg: { DEFAULT: v("fg"), 2: v("fg-2"), muted: v("fg-muted") },
        line: v("border"),
        signal: v("signal"),
        void: "#0A0A0A",
        bone: "#F7F2EC",
      },
      fontFamily: {
        serif: ["Tinos", "Times New Roman", "serif"],
        grot: ["Archivo", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        pixel: ["Silkscreen", "JetBrains Mono", "monospace"],
        screen: ["VT323", "JetBrains Mono", "monospace"],
      },
      transitionDuration: { 80: "80ms" },
    },
  },
  plugins: [],
};

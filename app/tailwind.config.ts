import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--color-canvas)",
        paper: "var(--color-paper)",
        ink: "var(--color-ink)",
        "ink-2": "var(--color-ink2)",
        "ink-3": "var(--color-ink3)",
        "ink-4": "var(--color-ink4)",
        divider: "var(--color-divider)",
        "divider-strong": "var(--color-divider-strong)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        text: ["var(--font-text)"],
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
        btn: "var(--radius-btn)",
      },
    },
  },
  plugins: [],
};

export default config;

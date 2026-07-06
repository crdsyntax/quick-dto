/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDark: "#121212",
        bgPanel: "#1a1a1a",
        borderDark: "#333333",
        accentLight: "#ffffff",
        textMain: "#f0f0f0",
        textMuted: "#a0a0a0",
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'modern': '0.625rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.4)',
        'glow-emerald': '0 0 12px rgba(16, 185, 129, 0.15)',
        'glow-red': '0 0 12px rgba(220, 38, 38, 0.15)',
      }
    },
  },
  plugins: [],
}

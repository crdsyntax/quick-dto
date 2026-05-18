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
        mono: ['Courier New', 'Courier', 'monospace'],
      },
      boxShadow: {
        'retro': '3px 3px 0px 0px rgba(255, 255, 255, 0.8)',
        'retro-dark': '3px 3px 0px 0px rgba(80, 80, 80, 0.5)'
      }
    },
  },
  plugins: [],
}

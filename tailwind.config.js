/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'enter': 'enter 0.2s ease-out',
        'leave': 'leave 0.2s ease-in forwards',
        'pulse-border': 'pulse-border 2s infinite',
      },
      keyframes: {
        'enter': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'leave': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-100%)', opacity: '0' },
        },
        'pulse-border': {
          '0%, 100%': { borderColor: 'rgb(74, 222, 128)', boxShadow: '0 10px 15px -3px rgb(74 222 128 / 0.3)' },
          '50%': { borderColor: 'rgb(134, 239, 172)', boxShadow: '0 10px 15px -3px rgb(134 239 172 / 0.5)' },
        },
      },
    },
  },
  plugins: [],
}
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        marker: '#FDE68A',
      },
      keyframes: {
        highlight: { from: { backgroundSize: '0% 100%' }, to: { backgroundSize: '100% 100%' } },
      },
      animation: {
        highlight: 'highlight 700ms ease-out both',
      },
    },
  },
  plugins: [],
};

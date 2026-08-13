/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#0ea5b7',
          600: '#078da2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#078da2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

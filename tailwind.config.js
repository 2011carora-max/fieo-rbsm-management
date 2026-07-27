/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fieo: {
          50: '#eef4fb',
          100: '#d6e4f4',
          200: '#b0c9e9',
          300: '#7ea6d8',
          400: '#4d80c4',
          500: '#2e62a8',
          600: '#1f4a8a', // primary blue
          700: '#1a3d72',
          800: '#16305c',
          900: '#112545',
          950: '#0b1830',
        },
        saffron: {
          50: '#fdf6ee',
          100: '#fae9d2',
          200: '#f5d0a3',
          300: '#eeb06a',
          400: '#e68f3a',
          500: '#df7620', // accent saffron
          600: '#c75e16',
          700: '#a44714',
          800: '#843a18',
          900: '#6c3117',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(15, 35, 80, 0.08), 0 4px 16px -4px rgba(15, 35, 80, 0.06)',
        'soft-lg': '0 8px 30px -8px rgba(15, 35, 80, 0.18), 0 2px 10px -4px rgba(15, 35, 80, 0.08)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-468px 0' },
          '100%': { backgroundPosition: '468px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};

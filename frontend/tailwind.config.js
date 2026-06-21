/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          pink:   '#FF0099',
          cyan:   '#00E5FF',
          lime:   '#AAFF00',
          purple: '#7B2FFF',
          navy:   '#1B1B4B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 16px rgba(255,0,153,0.5)',
        'neon-cyan': '0 0 16px rgba(0,229,255,0.5)',
        'neon-lime': '0 0 16px rgba(170,255,0,0.4)',
      }
    },
  },
  plugins: [],
}

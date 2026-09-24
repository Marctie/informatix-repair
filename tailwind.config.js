/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './src/**/*.{js,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0F19',
        primary: '#111827',
        secondary: { DEFAULT: '#DC2626', dark: '#B91C1C', light: '#FEE2E2' },
        accent: '#3B82F6',
        lightbg: '#F5F6F8',
        line: '#E5E7EB',
      },
      fontFamily: {
        heading: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(16 24 40 / 0.04), 0 8px 24px -8px rgb(16 24 40 / 0.10)',
        lift: '0 2px 4px rgb(16 24 40 / 0.05), 0 20px 40px -12px rgb(16 24 40 / 0.20)',
        glow: '0 10px 30px -8px rgb(220 38 38 / 0.55)',
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      animation: { floaty: 'floaty 6s ease-in-out infinite' },
    },
  },
  plugins: [],
};

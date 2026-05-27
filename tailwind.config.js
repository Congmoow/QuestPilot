import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-out-to-right': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-from-right 0.25s ease-out',
        'slide-out-right': 'slide-out-to-right 0.2s ease-in',
        'fade-in': 'fade-in 0.15s ease-out',
        'fade-out': 'fade-out 0.15s ease-in',
        'slide-in-bottom': 'slide-in-from-bottom 0.2s ease-out',
      },
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          active: '#1E40AF',
          soft: '#EAF2FF',
        },
        canvas: '#F3F7FC',
        surface: '#FFFFFF',
        accent: '#F97316',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#EF4444',
        gray: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        }
      },
      borderRadius: {
        card: '20px',
        control: '14px',
      },
      boxShadow: {
        card: '0 18px 48px rgba(15, 23, 42, 0.08)',
        soft: '0 12px 32px rgba(37, 99, 235, 0.10)',
        popover: '0 18px 48px rgba(15, 23, 42, 0.14)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [animate],
}

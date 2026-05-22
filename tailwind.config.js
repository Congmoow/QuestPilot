/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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
  plugins: [],
}

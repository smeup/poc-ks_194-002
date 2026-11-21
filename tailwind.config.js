/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-primary': {
          DEFAULT: '#a61a2f',
          100: '#edd1d5',
          200: '#dba3ac',
          300: '#ca7682',
          400: '#b84859',
          500: '#a61a2f',
          600: '#88182a',
          700: '#6b1724',
          800: '#4d151f',
          900: '#301419',
        },
        'brand-success': {
          DEFAULT: '#22b53d',
          100: '#d3f0d8',
          200: '#a7e1b1',
          300: '#7ad38b',
          400: '#4ec464',
          500: '#22b53d',
          600: '#1f9435',
          700: '#1c742d',
          800: '#185324',
          900: '#15331c',
        },
        'brand-info': {
          DEFAULT: '#007d7f',
          100: '#cce5e5',
          200: '#99cbcc',
          300: '#66b1b2',
          400: '#339799',
          500: '#007d7f',
          600: '#04686a',
          700: '#075254',
          800: '#0b3d3f',
          900: '#0e2729',
        },
        'brand-warning': {
          DEFAULT: '#e27c0f',
          100: '#f9e5cf',
          200: '#f3cb9f',
          300: '#eeb06f',
          400: '#e8963f',
          500: '#e27c0f',
          600: '#b86710',
          700: '#8f5211',
          800: '#653c12',
          900: '#3c2713',
        },
        'brand-danger': {
          DEFAULT: '#b71d2f',
          100: '#f1d2d5',
          200: '#e2a5ac',
          300: '#d47782',
          400: '#c54a59',
          500: '#b71d2f',
          600: '#961b2a',
          700: '#751924',
          800: '#54161f',
          900: '#331419',
        },
        fondo: '#f7f7f5',
        carta: '#ffffff',
        inchiostro: '#1a1a1e',
        tenue: '#6b6b73',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        carta:
          '0 1px 2px rgba(26, 26, 30, 0.04), 0 8px 24px -12px rgba(26, 26, 30, 0.18)',
        sollevata:
          '0 1px 2px rgba(26, 26, 30, 0.05), 0 16px 40px -16px rgba(26, 26, 30, 0.22)',
      },
      backgroundImage: {
        'brand-gradient-primary':
          'linear-gradient(135deg, #a61a2f 0%, #88182a 100%)',
        'brand-gradient-success':
          'linear-gradient(135deg, #22b53d 0%, #1f9435 100%)',
        'brand-gradient-info':
          'linear-gradient(135deg, #007d7f 0%, #04686a 100%)',
        'brand-gradient-warning':
          'linear-gradient(135deg, #e27c0f 0%, #b86710 100%)',
        'brand-gradient-danger':
          'linear-gradient(135deg, #b71d2f 0%, #961b2a 100%)',
      },
    },
  },
}

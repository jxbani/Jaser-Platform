import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F4C81',
          light: '#3A78B4',
          dark: '#082F50'
        }
      }
    }
  },
  plugins: []
};

export default config;

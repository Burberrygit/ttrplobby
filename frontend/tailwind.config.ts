// File: frontend/tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#29e0e3',
        brandHover: '#22c8cb',
      },
    },
  },
  safelist: [
    'text-brand', 'bg-brand', 'border-brand',
    'hover:text-brand', 'hover:bg-brandHover', 'hover:border-brand',
    'accent-brand',
  ],
  plugins: [],
}

export default config

import { COLORS } from './src/theme.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Un posto solo per i colori: vedi src/theme.js.
      colors: COLORS,
      fontFamily: {
        display: ["'Barlow Condensed'", 'Arial Narrow', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // I numeri di una torre dei tempi devono incolonnarsi: serve un monospace.
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Scala compatta: in orizzontale su telefono l'altezza è la risorsa scarsa.
        '2xs': ['9px', '1.25'],
        xs: ['10.5px', '1.35'],
        sm: ['12px', '1.4'],
        base: ['13px', '1.45'],
        lg: ['15px', '1.3'],
        xl: ['18px', '1.15'],
        '2xl': ['22px', '1.1'],
        '3xl': ['28px', '1'],
      },
    },
  },
  plugins: [],
};

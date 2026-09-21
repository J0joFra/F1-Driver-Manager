/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#0E1216',
        panel: '#161B21',
        panel2: '#1C232B',
        panel3: '#232B34',
        line: '#293240',
        ink: '#E9ECF1',
        muted: '#8B95A2',
        dim: '#5B6672',
        // Colori scuderia: validati per daltonismo, usati anche come palette dei grafici.
        aurora: '#E8283C',
        vantar: '#3E86F0',
        kestrel: '#12A06E',
        mirage: '#D4761E',
        nordvik: '#A06BE0',
        solaro: '#0E9BB4',
        brandt: '#DE5AA2',
        kaizen: '#94892A',
        good: '#2FD98A',
        warn: '#F5C518',
        bad: '#E8283C',
      },
      fontFamily: {
        display: ["'Saira Condensed'", 'Arial Narrow', 'sans-serif'],
        sans: ["'IBM Plex Sans'", 'system-ui', 'sans-serif'],
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

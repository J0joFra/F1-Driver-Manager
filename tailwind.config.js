/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Famiglia navy: fondo profondo, pannelli e bordi a salire.
        ground: '#0A1128',
        panel: '#131B33',
        panel2: '#1A2340',
        panel3: '#243054',
        line: '#243054',
        ink: '#F1F4F9',
        muted: '#94A3B8',
        dim: '#64748B',
        // Verde d'azione e giallo di richiamo, separati dai colori scuderia.
        primary: '#10B981',
        accent: '#FFD60A',
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

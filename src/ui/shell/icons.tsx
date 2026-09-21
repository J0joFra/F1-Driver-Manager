/** Icone della rail: tratti semplici, leggibili a 18 px. */
const P = ({ d }: { d: string }) => <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />;

export const Icon = ({ name, size = 18 }: { name: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {name === 'paddock' && <><P d="M3 20V9l9-5 9 5v11" /><P d="M9 20v-6h6v6" /></>}
    {name === 'pilota' && <><P d="M12 12a4 4 0 100-8 4 4 0 000 8z" /><P d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" /></>}
    {name === 'allenamento' && <><P d="M6 4v16M18 4v16M6 12h12" /><P d="M3 9v6M21 9v6" /></>}
    {name === 'finanze' && <><P d="M12 3v18" /><P d="M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.5s2 2.7 5 3.3 5 1.4 5 3.4-2.2 3.3-5 3.3-5-1.1-5-3" /></>}
    {name === 'scuderia' && <><P d="M3 16l2-5h14l2 5" /><P d="M3 16h18v3H3z" /><P d="M7 11l1.5-4h7L17 11" /></>}
    {name === 'classifiche' && <><P d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></>}
    {name === 'storia' && <><P d="M12 8v4l3 2" /><P d="M12 21a9 9 0 110-18 9 9 0 010 18z" /></>}
    {name === 'next' && <><P d="M5 12h14M13 6l6 6-6 6" /></>}
    {name === 'rotate' && <><P d="M7 4h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3z" /><P d="M9 9l6 6M15 9l-6 6" /></>}
  </svg>
);

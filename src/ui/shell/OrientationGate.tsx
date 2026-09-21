import { useEffect, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * Il gioco si tiene in orizzontale. Su schermi stretti e verticali mostriamo
 * un invito a ruotare invece di comprimere un'interfaccia pensata per 390 px
 * di altezza in uno spazio che non li ha.
 *
 * La build Android bloccherà l'orientamento via Capacitor; questo resta come
 * rete di sicurezza per il browser.
 */
export function OrientationGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const check = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setBlocked(portrait && window.innerWidth < 700);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (blocked) {
    return (
      <div className="h-full grid place-items-center px-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-accent animate-pulse">
            <RotateCcw className="w-11 h-11" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wide">RUOTA IL TELEFONO</h1>
          <p className="text-sm text-muted max-w-xs leading-relaxed">
            F1 Driver Manager si gioca in orizzontale: la torre dei tempi e la pista hanno bisogno di larghezza.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

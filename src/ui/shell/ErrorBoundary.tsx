import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Rete di sicurezza.
 *
 * Senza, qualunque eccezione in fase di render smonta l'albero e lascia uno
 * schermo nero senza alcun modo di uscirne: nemmeno un pulsante per ripartire.
 * È esattamente quello che è successo con un salvataggio scritto da una
 * versione precedente.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Errore non gestito nell’interfaccia', error, info.componentStack);
  }

  private reset = (): void => {
    try {
      localStorage.removeItem('f1dm-save-v1');
    } catch {
      // In una finestra privata lo storage può non essere accessibile: si
      // ricarica comunque, che è già meglio dello schermo nero.
    }
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="h-full grid place-items-center px-8 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-xl font-bold uppercase tracking-wide text-bad">
            Qualcosa si è rotto
          </h1>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            L'interfaccia non è riuscita a disegnare questa schermata. Il salvataggio potrebbe
            essere stato scritto da una versione precedente del gioco.
          </p>
          <pre className="font-mono text-[9px] text-dim bg-panel border border-line rounded p-2 mt-3
            text-left overflow-x-auto">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={this.reset}
            className="mt-4 rounded bg-aurora px-4 py-2 text-xs font-sans font-semibold text-white"
          >
            Cancella il salvataggio e ricomincia
          </button>
        </div>
      </div>
    );
  }
}

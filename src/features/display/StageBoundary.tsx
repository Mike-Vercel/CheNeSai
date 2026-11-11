"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Rete di sicurezza dello show (TV, show sul telefono, /tv): se una schermata va in errore
 * (driver grafico, dati inattesi, memoria del telefono) NON resta mai uno schermo bianco.
 * Si avvisa chi la contiene (che passa ai personaggi 2D, più leggeri) e si riprova da soli dopo
 * un attimo; nel frattempo resta un fondo dello show con un messaggio.
 */
export class StageBoundary extends Component<{ children: ReactNode; onError?: (e: unknown) => void; portrait?: boolean }, { failed: boolean }> {
  state = { failed: false };
  private retry: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[show] schermata non disponibile, riprovo", error, info.componentStack);
    this.props.onError?.(error);
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(() => this.setState({ failed: false }), 1500);
  }

  componentWillUnmount() {
    if (this.retry) clearTimeout(this.retry);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#3a1466,#170824_70%)]" role="status">
        <p className={this.props.portrait ? "font-display text-[6cqw] text-gold" : "font-display text-[5cqh] text-gold"}>Un attimo…</p>
      </div>
    );
  }
}

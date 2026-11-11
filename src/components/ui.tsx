"use client";

import { clsx } from "clsx";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type Variant = "gold" | "primary" | "danger" | "success" | "ghost" | "outline" | "violet";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  gold: "bg-gradient-to-b from-[#ffe680] via-gold to-gold-deep text-ink border-[#b8770a] shadow-[0_4px_0_#9a5d00] hover:brightness-110",
  primary: "bg-gradient-to-b from-[#3d9bff] to-electric text-white border-[#0753b0] shadow-[0_4px_0_#05408a] hover:brightness-110",
  danger: "bg-gradient-to-b from-[#ff5a74] to-flame text-white border-[#a10f2a] shadow-[0_4px_0_#7e0b21] hover:brightness-110",
  success: "bg-gradient-to-b from-[#3cf095] to-lime text-ink border-[#008a44] shadow-[0_4px_0_#006b35] hover:brightness-110",
  violet: "bg-gradient-to-b from-[#a463ff] to-violet text-white border-[#5212b8] shadow-[0_4px_0_#420e96] hover:brightness-110",
  ghost: "bg-white/5 text-white border-white/10 hover:bg-white/10",
  outline: "bg-transparent text-gold border-gold/60 hover:bg-gold/10",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-[15px] rounded-xl",
  lg: "h-14 px-6 text-lg rounded-2xl",
  xl: "min-h-20 px-6 text-2xl rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "relative inline-flex select-none items-center justify-center gap-2 border-2 font-extrabold tracking-wide transition active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin", className ?? "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Panel / Badge
// ---------------------------------------------------------------------------
export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-2xl border border-white/10 bg-[#1d0c30] p-4 shadow-lg", className)}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-display text-xl tracking-wide text-gold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const BADGE: Record<string, string> = {
  gray: "bg-white/10 text-white/80",
  gold: "bg-gold/20 text-gold",
  green: "bg-lime/20 text-[#5dffab]",
  red: "bg-flame/20 text-[#ff8098]",
  blue: "bg-electric/25 text-[#8cc4ff]",
  violet: "bg-violet/25 text-[#c9a3ff]",
  fuchsia: "bg-fuchsia/20 text-[#ff8cc8]",
};
export function Badge({ color = "gray", children, className }: { color?: keyof typeof BADGE; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", BADGE[color], className)}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
const FIELD = "w-full rounded-xl border border-white/15 bg-[#0f0519] px-3 py-2 text-[15px] text-white placeholder:text-white/35 focus:border-cyan focus:outline-none";

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-bold text-white/80">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-white/50">{hint}</p>}
      {error && <p className="text-xs font-bold text-[#ff8098]">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(FIELD, className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={clsx(FIELD, "pr-8", className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(FIELD, "min-h-24", className)} {...rest} />;
});

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={clsx("inline-flex cursor-pointer items-center gap-2 text-sm font-bold", disabled && "opacity-50")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx("relative h-6 w-11 rounded-full transition", checked ? "bg-lime" : "bg-white/20")}
      >
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Dialog di conferma (mai window.confirm: non blocca il browser in regia)
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx("max-h-[90dvh] w-full overflow-auto rounded-2xl border-2 border-gold/50 bg-[#1d0c30] p-5 shadow-2xl outline-none", wide ? "max-w-4xl" : "max-w-lg")}
      >
        <h2 className="mb-3 font-display text-2xl text-gold">{title}</h2>
        <div className="text-white/90">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Richiede di digitare questa parola per confermare (azioni molto distruttive). */
  typeToConfirm?: string;
}
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState("");
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    setTyped("");
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };
  const blocked = !!opts?.typeToConfirm && typed.trim().toUpperCase() !== opts.typeToConfirm.toUpperCase();
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => close(false)}
        title={opts?.title ?? ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Annulla
            </Button>
            <Button variant={opts?.danger ? "danger" : "gold"} disabled={blocked} onClick={() => close(true)} autoFocus>
              {opts?.confirmLabel ?? "Conferma"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>{opts?.message}</div>
          {opts?.typeToConfirm && (
            <Input placeholder={`Scrivi ${opts.typeToConfirm} per confermare`} value={typed} onChange={(e) => setTyped(e.target.value)} />
          )}
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error("useConfirm fuori da ConfirmProvider");
  return c;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
interface Toast {
  id: number;
  kind: "ok" | "error" | "info";
  text: string;
}
const ToastCtx = createContext<((kind: Toast["kind"], text: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto rounded-xl border-2 px-4 py-3 text-sm font-bold shadow-xl animate-pop-in",
              t.kind === "ok" && "border-lime bg-[#0b3a22] text-[#bfffdc]",
              t.kind === "error" && "border-flame bg-[#3d0914] text-[#ffc2cd]",
              t.kind === "info" && "border-cyan bg-[#08283a] text-[#bff4ff]",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const t = useContext(ToastCtx);
  if (!t) throw new Error("useToast fuori da ToastProvider");
  return t;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/60">
      <p className="font-display text-xl text-white/80">{title}</p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

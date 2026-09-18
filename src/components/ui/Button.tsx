import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'min-h-11 rounded-xl bg-[var(--danger)] px-4 py-3 font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60',
  ghost: 'min-h-11 rounded-xl px-3 py-2 font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
}>(({ variant = 'secondary', loading = false, loadingLabel, icon, children, className = '', disabled, ...props }, ref) => (
  <button
    {...props}
    ref={ref}
    className={`${variantClasses[variant]} inline-flex items-center justify-center gap-2 ${className}`}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
  >
    {icon}
    {loading ? (loadingLabel || children) : children}
  </button>
));

Button.displayName = 'Button';

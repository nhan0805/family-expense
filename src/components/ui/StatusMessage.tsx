import type { ReactNode } from 'react';

type StatusTone = 'info' | 'success' | 'warning' | 'error';

const toneClasses: Record<StatusTone, string> = {
  info: 'border-[var(--info)] bg-[var(--info-soft)] text-[var(--info-strong)]',
  success: 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success-strong)]',
  warning: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-strong)]',
  error: 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-strong)]',
};

export function StatusMessage({
  tone,
  children,
  className = '',
  live = tone === 'error' ? 'assertive' : 'polite',
  id,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
  live?: 'assertive' | 'polite' | 'off';
  id?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${toneClasses[tone]} ${className}`}
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={live}
    >
      {children}
    </div>
  );
}

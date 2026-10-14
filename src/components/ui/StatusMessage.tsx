import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type StatusTone = 'info' | 'success' | 'warning' | 'error';

const toneClasses: Record<StatusTone, string> = {
  info: 'border-[var(--info)] bg-[var(--info-soft)] text-[var(--info-strong)]',
  success: 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success-strong)]',
  warning: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning-strong)]',
  error: 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-strong)]',
};
const toneIcons = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertTriangle };

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
  const Icon = toneIcons[tone];
  return (
    <div
      className={`status-message status-message-${tone} ${toneClasses[tone]} ${className}`}
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={live}
    >
      <Icon className="status-message-icon" size={18} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

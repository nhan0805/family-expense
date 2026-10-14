import type { LucideIcon } from 'lucide-react';
import { useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

export function IconButton({
  label,
  icon: Icon,
  className = '',
  title = label,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      title={title}
      {...props}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
};

export function Field({ label, hint, error, id, className = '', required, ...props }: FieldProps) {
  const generatedId = useId();
  const fieldId = id || `field-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

  return (
    <label className="min-w-0">
      <span className="label">
        {label}
        {required && <span className="ml-1 text-[var(--danger-strong)]" aria-hidden="true">*</span>}
      </span>
      <input
        {...props}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={describedBy}
        className={`field ${className}`.trim()}
      />
      {hint && <span id={hintId} className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
      {error && <span id={errorId} className="mt-1 block text-sm text-[var(--danger-strong)]" role="alert">{error}</span>}
    </label>
  );
}

export type TabDefinition<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
};

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  className = '',
}: {
  tabs: Array<TabDefinition<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  idPrefix: string;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    if (!next) return;
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className={`catalog-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {tabs.map(({ id, label, icon: Icon }, index) => (
        <button
          key={id}
          ref={(element) => { refs.current[id] = element; }}
          id={`${idPrefix}-tab-${id}`}
          type="button"
          role="tab"
          aria-selected={value === id}
          aria-controls={`${idPrefix}-panel-${id}`}
          tabIndex={value === id ? 0 : -1}
          className="catalog-tab inline-flex items-center justify-center gap-2"
          onClick={() => onChange(id)}
          onKeyDown={(event) => {
            if (event.key === 'Home') {
              event.preventDefault();
              move(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              move(tabs.length - 1);
            } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
              event.preventDefault();
              move(index + 1);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              event.preventDefault();
              move(index - 1);
            }
          }}
        >
          {Icon && <Icon size={17} aria-hidden="true" />}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

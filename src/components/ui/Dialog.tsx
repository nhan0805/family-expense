import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type FocusTrapOptions = {
  onEscape?: () => void;
  restoreFocus?: boolean;
};

/**
 * Keeps keyboard focus inside a transient surface and returns it to the
 * control that opened the surface after it closes.
 */
export function useFocusTrap<T extends HTMLElement>(
  open: boolean,
  { onEscape, restoreFocus = true }: FocusTrapOptions = {},
): RefObject<T | null> {
  const surfaceRef = useRef<T | null>(null);
  const escapeHandlerRef = useRef(onEscape);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    escapeHandlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) return undefined;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusTimer = window.setTimeout(() => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const preferred = surface.querySelector<HTMLElement>('[data-dialog-autofocus]');
      const first = preferred || surface.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        escapeHandlerRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !surfaceRef.current) return;
      const focusable = Array.from(surfaceRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute('aria-hidden'));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const trigger = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (restoreFocus && trigger && document.contains(trigger)) {
        window.setTimeout(() => trigger.focus(), 0);
      }
    };
  }, [open, restoreFocus]);

  return surfaceRef;
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  closing?: boolean;
  className?: string;
  panelClassName?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  role = 'dialog',
  closing = false,
  className = '',
  panelClassName = '',
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useFocusTrap<HTMLElement>(open, { onEscape: onClose });

  if (!open) return null;

  const dialog = (
    <div
      className={`fixed inset-0 z-[90] grid place-items-end bg-[var(--overlay)] p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4 ${closing ? 'ui-overlay-exit' : 'ui-overlay-enter'} ${className}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <section
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`max-h-[min(90dvh,48rem)] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-dialog)] bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-overlay)] sm:rounded-[var(--radius-dialog)] sm:pb-5 ${closing ? 'ui-dialog-exit' : 'ui-dialog-enter'} ${panelClassName}`}
      >
        <h2 id={titleId} className="text-lg font-extrabold">{title}</h2>
        {description && <p id={descriptionId} className="mt-2 text-sm text-[var(--muted)]">{description}</p>}
        {children}
        {footer && <div className="mt-5">{footer}</div>}
      </section>
    </div>
  );

  // Keep fixed positioning relative to the viewport, even when the page content
  // is inside an animated/transformed route wrapper.
  if (typeof document === 'undefined') return dialog;
  return createPortal(dialog, document.body);
}

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };
type ConfirmOptions = { title: string; description: string; confirmLabel?: string; danger?: boolean };
type FeedbackValue = { notify: (message: string, tone?: ToastTone) => void; askConfirm: (options: ConfirmOptions) => Promise<boolean> };

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [closingToastIds, setClosingToastIds] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const [dialogClosing, setDialogClosing] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const closingToastIdsRef = useRef(new Set<number>());
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    if (closingToastIdsRef.current.has(id)) return;
    closingToastIdsRef.current.add(id);
    setClosingToastIds((items) => new Set(items).add(id));
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
      setClosingToastIds((items) => {
        const next = new Set(items);
        next.delete(id);
        return next;
      });
      closingToastIdsRef.current.delete(id);
    }, 180);
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((items) => [...items, { id, message, tone }]);
    window.setTimeout(() => dismissToast(id), 3500);
  }, [dismissToast]);
  const askConfirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setDialogClosing(false);
    setDialog(options);
  }), []);
  const closeDialog = (result: boolean) => {
    if (dialogClosing) return;
    resolver.current?.(result);
    resolver.current = null;
    setDialogClosing(true);
    window.setTimeout(() => {
      setDialog(null);
      setDialogClosing(false);
    }, 180);
  };
  const value = useMemo(() => ({ notify, askConfirm }), [notify, askConfirm]);

  return <FeedbackContext.Provider value={value}>{children}
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-4" aria-live="polite">{toasts.map((toast) => { const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertTriangle : Info; return <div key={toast.id} className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-white p-3 shadow-xl ${closingToastIds.has(toast.id) ? 'ui-toast-exit' : 'ui-enter'} dark:bg-[#343746] ${toast.tone === 'error' ? 'border-red-200 text-red-800 dark:border-red-900 dark:text-red-200' : toast.tone === 'success' ? 'border-emerald-200 text-emerald-800 dark:border-emerald-900 dark:text-emerald-200' : 'border-sky-200 text-sky-800 dark:border-sky-900 dark:text-sky-200'}`}><Icon size={19} className="shrink-0"/><span className="min-w-0 flex-1 text-sm font-medium">{toast.message}</span><button type="button" className="rounded-lg p-1" aria-label="Đóng thông báo" onClick={() => dismissToast(toast.id)}><X size={16}/></button></div>; })}</div>
    {dialog && <div className={`fixed inset-0 z-[90] grid place-items-end bg-black/45 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-4 ${dialogClosing ? 'ui-overlay-exit' : 'ui-overlay-enter'}`} role="presentation"><section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className={`w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-[#343746] sm:rounded-3xl ${dialogClosing ? 'ui-dialog-exit' : 'ui-dialog-enter'}`}><span className={`mb-4 grid size-11 place-items-center rounded-2xl ${dialog.danger ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'}`}><AlertTriangle size={22}/></span><h2 id="confirm-title" className="text-lg font-extrabold">{dialog.title}</h2><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{dialog.description}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" className="btn-secondary" onClick={() => closeDialog(false)}>Hủy</button><button type="button" className={dialog.danger ? 'rounded-xl bg-red-600 px-4 py-3 font-bold text-white' : 'btn-primary'} onClick={() => closeDialog(true)}>{dialog.confirmLabel || 'Xác nhận'}</button></div></section></div>}
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('FeedbackProvider missing');
  return value;
}

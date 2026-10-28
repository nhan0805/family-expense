import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useOptionalLanguage } from '../context/LanguageContext';
import { Dialog } from './ui/Dialog';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };
type ConfirmOptions = { title: string; description: string; confirmLabel?: string; danger?: boolean };
type ConfirmRequest = { options: ConfirmOptions; resolve: (value: boolean) => void };
type FeedbackValue = { notify: (message: string, tone?: ToastTone) => void; askConfirm: (options: ConfirmOptions) => Promise<boolean> };

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [closingToastIds, setClosingToastIds] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const [dialogClosing, setDialogClosing] = useState(false);
  const activeConfirm = useRef<ConfirmRequest | null>(null);
  const confirmQueue = useRef<ConfirmRequest[]>([]);
  const dialogClosingRef = useRef(false);
  const closingToastIdsRef = useRef(new Set<number>());
  const timeoutIdsRef = useRef(new Set<number>());
  const nextId = useRef(1);

  const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutIdsRef.current.add(timeoutId);
  }, []);

  useEffect(() => () => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current.clear();
    activeConfirm.current?.resolve(false);
    confirmQueue.current.forEach((request) => request.resolve(false));
    activeConfirm.current = null;
    confirmQueue.current = [];
  }, []);

  const dismissToast = useCallback((id: number) => {
    if (closingToastIdsRef.current.has(id)) return;
    closingToastIdsRef.current.add(id);
    setClosingToastIds((items) => new Set(items).add(id));
    scheduleTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
      setClosingToastIds((items) => {
        const next = new Set(items);
        next.delete(id);
        return next;
      });
      closingToastIdsRef.current.delete(id);
    }, 180);
  }, [scheduleTimeout]);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((items) => [...items, { id, message, tone }]);
    scheduleTimeout(() => dismissToast(id), 3500);
  }, [dismissToast, scheduleTimeout]);
  const activateNextConfirm = useCallback(() => {
    const next = confirmQueue.current.shift();
    if (!next) {
      activeConfirm.current = null;
      setDialog(null);
      return;
    }
    activeConfirm.current = next;
    dialogClosingRef.current = false;
    setDialogClosing(false);
    setDialog(next.options);
  }, []);
  const askConfirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    confirmQueue.current.push({ options, resolve });
    if (!activeConfirm.current && !dialogClosingRef.current) activateNextConfirm();
  }), [activateNextConfirm]);
  const closeDialog = useCallback((result: boolean) => {
    if (dialogClosing) return;
    activeConfirm.current?.resolve(result);
    dialogClosingRef.current = true;
    setDialogClosing(true);
    scheduleTimeout(() => {
      dialogClosingRef.current = false;
      activeConfirm.current = null;
      if (confirmQueue.current.length) activateNextConfirm();
      else {
        setDialog(null);
        setDialogClosing(false);
      }
    }, 180);
  }, [activateNextConfirm, dialogClosing, scheduleTimeout]);
  const value = useMemo(() => ({ notify, askConfirm }), [notify, askConfirm]);

  return <FeedbackContext.Provider value={value}>{children}
    <div className="feedback-toast-stack" aria-live="polite">{toasts.map((toast) => { const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertTriangle : Info; return <div key={toast.id} className={`feedback-toast feedback-toast-${toast.tone} ${closingToastIds.has(toast.id) ? 'ui-toast-exit' : 'ui-enter'}`} role={toast.tone === 'error' ? 'alert' : 'status'}><span className="feedback-toast-icon" aria-hidden="true"><Icon size={18} /></span><span className="min-w-0 flex-1 text-sm font-semibold">{toast.message}</span><button type="button" className="feedback-toast-close" aria-label={en ? 'Close notification' : 'Đóng thông báo'} onClick={() => dismissToast(toast.id)}><X size={16} aria-hidden="true"/></button></div>; })}</div>
    {dialog && <Dialog open onClose={() => closeDialog(false)} title={dialog.title} description={dialog.description} role="alertdialog" closing={dialogClosing} panelClassName="sm:max-w-md"><span className={`mb-4 mt-4 grid size-11 place-items-center rounded-2xl ${dialog.danger ? 'bg-[var(--danger-soft)] text-[var(--danger-strong)]' : 'bg-[var(--warning-soft)] text-[var(--warning-strong)]'}`}><AlertTriangle size={22} aria-hidden="true"/></span><div className="grid grid-cols-2 gap-2"><button type="button" className="btn-secondary" data-dialog-autofocus onClick={() => closeDialog(false)}>{en ? 'Cancel' : 'Hủy'}</button><button type="button" className={dialog.danger ? 'min-h-11 rounded-xl bg-[var(--danger)] px-4 py-3 font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]' : 'btn-primary'} onClick={() => closeDialog(true)}>{dialog.confirmLabel || (en ? 'Confirm' : 'Xác nhận')}</button></div></Dialog>}
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('FeedbackProvider missing');
  return value;
}

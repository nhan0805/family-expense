import { Bell, Check, CircleAlert, Trash2, TriangleAlert } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFeedback } from './Feedback';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import {
  buildLocalBudgetSummary,
  type BudgetSummary,
} from '../lib/budget';
import type { CatalogItem, Transaction } from '../lib/domain';
import {
  buildBudgetFilterLink,
  fetchBudgetSummary,
} from '../lib/budgetsApi';
import { fetchDashboardDueTransactions } from '../lib/transactionsApi';
import {
  deleteReadBudgetNotifications,
  getBudgetNotifications,
  markAllBudgetNotificationsRead,
  markBudgetNotificationRead,
  syncBudgetNotifications,
  type BudgetNotification,
} from '../lib/budgetNotifications';
import { isSupabaseConfigured } from '../lib/supabase';

const emptyCatalogItems: CatalogItem[] = [];
const emptyTransactions: Transaction[] = [];

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7);
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatMoney(value: number, language: 'vi' | 'en') {
  return `${Math.round(value).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN')} ₫`;
}

function formatDueDate(value: string, language: 'vi' | 'en') {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatPeriod(notification: BudgetNotification, language: 'vi' | 'en') {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(Date.UTC(notification.year, notification.month - 1, 1)));
}

function notificationMessage(notification: BudgetNotification, language: 'vi' | 'en') {
  const name = language === 'en'
    ? notification.purposeNameEn || notification.purposeName
    : notification.purposeName;
  const progress = `${formatMoney(notification.spent, language)} / ${formatMoney(notification.budget, language)}`;
  return notification.kind === 'over'
    ? language === 'en'
      ? `Budget exceeded for ${name}: ${progress}.`
      : `Đã vượt ngân sách ${name}: ${progress}.`
    : language === 'en'
      ? `${name} has reached ${Math.round(notification.thresholdPercent)}% of its budget: ${progress}.`
      : `${name} đã dùng ${Math.round(notification.thresholdPercent)}% ngân sách: ${progress}.`;
}

function notificationLabel(notification: BudgetNotification, language: 'vi' | 'en') {
  return notification.kind === 'over'
    ? language === 'en' ? 'Over budget' : 'Đã vượt ngân sách'
    : language === 'en' ? 'Near limit' : 'Sắp vượt ngân sách';
}

function notificationTone(notification: BudgetNotification) {
  return notification.kind === 'over'
    ? 'border-rose-200 bg-rose-50 dark:border-[#ff555566] dark:bg-[#ff55551f]'
    : 'border-amber-200 bg-amber-50 dark:border-[#f1fa8c66] dark:bg-[#f1fa8c1f]';
}

export function BudgetNotifications() {
  const queryClient = useQueryClient();
  const app = useApp();
  const familyId = app.familyId;
  const purposes = app.purposes ?? emptyCatalogItems;
  const transactions = app.transactions ?? emptyTransactions;
  const confirmPlannedTransaction = app.confirmPlannedTransaction;
  const { language, t } = useOptionalLanguage();
  const en = language === 'en';
  const { notify, askConfirm } = useFeedback();
  const [open, setOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmingIdRef = useRef<string | null>(null);
  const [dueError, setDueError] = useState('');
  const [notifications, setNotifications] = useState<BudgetNotification[]>(() =>
    familyId ? getBudgetNotifications(familyId) : [],
  );
  const monthKey = currentMonthKey();
  const [yearValue = '2000', monthValue = '1'] = monthKey.split('-');
  const year = Number(yearValue);
  const month = Number(monthValue);
  const localSummary = useMemo(
    () => buildLocalBudgetSummary(purposes, transactions, year, month),
    [month, purposes, transactions, year],
  );
  const { data: summaryData, refetch: refetchSummary } = useQuery({
    queryKey: ['budgets', familyId, year, month],
    queryFn: () => fetchBudgetSummary(familyId, year, month),
    enabled: isSupabaseConfigured && Boolean(familyId),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const summary: BudgetSummary | undefined = isSupabaseConfigured
    ? summaryData
    : localSummary;
  const localDueTransactions = useMemo(
    () => transactions
      .filter((transaction) => !transaction.deletedAt && transaction.status === 'Dự kiến' && transaction.transactionDate <= todayKey())
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate)),
    [transactions],
  );
  const { data: dueTransactionsData } = useQuery({
    queryKey: ['dashboard-due', familyId],
    queryFn: () => fetchDashboardDueTransactions(familyId, todayKey()),
    enabled: isSupabaseConfigured && Boolean(familyId),
    retry: false,
  });
  const dueTransactions = isSupabaseConfigured ? dueTransactionsData || [] : localDueTransactions;

  useEffect(() => {
    setNotifications(familyId ? getBudgetNotifications(familyId) : []);
  }, [familyId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !familyId) return;
    void refetchSummary();
  }, [familyId, purposes, refetchSummary]);

  useEffect(() => {
    if (!familyId || !summary) return;
    const result = syncBudgetNotifications(familyId, summary);
    setNotifications(result.notifications);
    result.newNotifications.slice(0, 3).forEach((notification) => {
      notify(notificationMessage(notification, language), notification.kind === 'over' ? 'error' : 'info');
    });
  }, [familyId, language, notify, summary]);

  if (!familyId) return null;

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const readCount = notifications.length - unreadCount;
  const attentionCount = unreadCount + dueTransactions.length;
  const notificationTitle = en ? 'Notifications' : 'Thông báo';
  const visibleNotifications = notifications.slice(0, 12);
  const markRead = (id: string) => {
    markBudgetNotificationRead(id);
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  };
  const markAllRead = () => {
    const next = markAllBudgetNotificationsRead(familyId);
    setNotifications(next);
  };
  const deleteRead = () => {
    const next = deleteReadBudgetNotifications(familyId);
    setNotifications(next);
  };
  const confirmDueTransactions = async (items: Transaction[]) => {
    if (!items.length || confirmingIdRef.current) return;
    if (!await askConfirm({
      title: en ? 'Confirm planned transactions?' : 'Xác nhận giao dịch dự kiến?',
      description: en
        ? `${items.length} transaction(s) due will be moved to Actual.`
        : `${items.length} giao dịch đến hạn sẽ chuyển sang Thực tế.`,
      confirmLabel: en ? 'Confirm' : 'Xác nhận',
    })) return;

    const token = items.length === 1 ? items[0]!.id : 'all';
    confirmingIdRef.current = token;
    setConfirmingId(token);
    setDueError('');
    let confirmedCount = 0;
    let firstError = '';
    for (const item of items) {
      try {
        const result = await confirmPlannedTransaction(item.id);
        if (result && !firstError) firstError = result;
        if (!result) confirmedCount += 1;
      } catch {
        if (!firstError) firstError = en ? 'Could not confirm a planned transaction.' : 'Không thể xác nhận giao dịch dự kiến.';
      }
    }
    confirmingIdRef.current = null;
    setConfirmingId(null);
    if (firstError) setDueError(firstError);
    if (isSupabaseConfigured) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard-due', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-data', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['budgets', familyId] }),
      ]);
    }
    if (confirmedCount > 0) notify(en ? `Confirmed ${confirmedCount} planned transaction(s).` : `Đã xác nhận ${confirmedCount} giao dịch dự kiến.`);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="icon-button relative"
        aria-label={notificationTitle}
        aria-expanded={open}
        aria-controls="budget-notifications-panel"
        title={notificationTitle}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} />
        {attentionCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid min-w-5 -translate-y-1/4 translate-x-1/4 place-items-center rounded-full bg-[#ff5555] px-1 text-[10px] font-extrabold leading-5 text-white"
            aria-label={`${attentionCount} ${en ? 'notifications need attention' : 'mục cần chú ý'}`}
          >
            {attentionCount > 99 ? '99+' : attentionCount}
          </span>
        )}
      </button>
      {open && (
        <section
          id="budget-notifications-panel"
          role="dialog"
          aria-label={notificationTitle}
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-[#6272a466] dark:bg-[#343746]"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 dark:border-[#6272a466]">
            <div>
              <h2 className="font-extrabold">{notificationTitle}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
                {attentionCount > 0 ? `${attentionCount} ${en ? 'items need attention' : 'mục cần chú ý'}` : t('allBudgetNotificationsRead')}
              </p>
            </div>
            {(unreadCount > 0 || readCount > 0) && <div className="flex flex-wrap items-center justify-end gap-2">
              {unreadCount > 0 && <button type="button" className="text-xs font-bold text-purple-700 hover:underline dark:text-[#bd93f9]" onClick={markAllRead}>
                {t('markAllRead')}
              </button>}
              {readCount > 0 && <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:underline dark:text-[#ff6e6e]" onClick={deleteRead}>
                <Trash2 size={14} aria-hidden="true" />
                {en ? 'Delete read' : 'Xóa đã đọc'}
              </button>}
            </div>}
          </div>
          {dueTransactions.length > 0 && <div className="border-b border-amber-200 bg-amber-50/70 p-3 dark:border-[#f1fa8c44] dark:bg-[#f1fa8c14]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold">{en ? 'Planned transactions due' : 'Giao dịch dự kiến tới hạn'}</h3>
                <p className="mt-0.5 text-xs text-amber-900/75 dark:text-amber-100/75">{en ? `${dueTransactions.length} transaction(s) need confirmation.` : `${dueTransactions.length} giao dịch cần xác nhận.`}</p>
              </div>
              {dueTransactions.length > 1 && <button type="button" className="btn-primary shrink-0 px-3 py-2 text-xs" disabled={Boolean(confirmingId)} onClick={() => void confirmDueTransactions(dueTransactions)}>
                {en ? 'Confirm all' : 'Xác nhận tất cả'}
              </button>}
            </div>
            {dueError && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{dueError}</p>}
            <ul className="mt-2 divide-y divide-amber-200/70 dark:divide-[#f1fa8c33]">
              {dueTransactions.slice(0, 5).map((transaction) => <li key={transaction.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{transaction.description}</p>
                  <p className="text-[11px] text-amber-900/70 dark:text-amber-100/70">{formatDueDate(transaction.transactionDate, language)} · {formatMoney(transaction.amount, language)}</p>
                </div>
                <button type="button" className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/50" disabled={Boolean(confirmingId)} onClick={() => void confirmDueTransactions([transaction])}>
                  {confirmingId === transaction.id ? (en ? 'Confirming…' : 'Đang xác nhận…') : (en ? 'Confirm' : 'Xác nhận')}
                </button>
              </li>)}
            </ul>
            {dueTransactions.length > 5 && <p className="mt-2 text-[11px] text-amber-900/70 dark:text-amber-100/70">{en ? `Showing 5 of ${dueTransactions.length}.` : `Đang hiển thị 5/${dueTransactions.length} giao dịch.`}</p>}
          </div>}
          {visibleNotifications.length > 0 ? (
            <ul className="max-h-[min(28rem,calc(100vh-10rem))] overflow-y-auto p-2">
              {visibleNotifications.map((notification) => {
                const name = language === 'en'
                  ? notification.purposeNameEn || notification.purposeName
                  : notification.purposeName;
                const Icon = notification.kind === 'over' ? CircleAlert : TriangleAlert;
                return (
                  <li key={notification.id}>
                    <Link
                      to={buildBudgetFilterLink(notification.purposeId, notification.year, notification.month)}
                      className={`block rounded-xl border p-3 transition hover:brightness-95 dark:hover:brightness-110 ${notificationTone(notification)} ${notification.readAt ? 'opacity-70' : ''}`}
                      onClick={() => { markRead(notification.id); setOpen(false); }}
                    >
                      <div className="flex items-start gap-2">
                        <Icon size={18} className={notification.kind === 'over' ? 'mt-0.5 shrink-0 text-rose-700 dark:text-[#ff5555]' : 'mt-0.5 shrink-0 text-amber-700 dark:text-[#f1fa8c]'} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-snug">{notificationLabel(notification, language)}: {name}</p>
                          <p className="mt-1 text-xs text-gray-700 dark:text-gray-200">{notificationMessage(notification, language)}</p>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-300">{formatPeriod(notification, language)} · {t('viewTransactions')}</p>
                        </div>
                        {!notification.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-[#bd93f9]" aria-label={t('unreadBudgetNotification')} />}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-300">
              <Check size={24} className="mx-auto mb-2 text-emerald-600 dark:text-[#50fa7b]" aria-hidden="true" />
              {t('noBudgetNotifications')}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

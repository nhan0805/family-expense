import { Bell, CalendarClock, CheckCircle2, CircleAlert, Trash2, TriangleAlert, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import {
  fetchDashboardDueTransactions,
  REMOTE_TRANSACTION_REFRESH_INTERVAL_MS,
} from '../lib/transactionsApi';
import {
  deleteReadBudgetNotifications,
  getBudgetNotifications,
  markAllBudgetNotificationsRead,
  markBudgetNotificationRead,
  syncBudgetNotifications,
  type BudgetNotification,
} from '../lib/budgetNotifications';
import { isSupabaseConfigured } from '../lib/supabase';
import { useFocusTrap } from './ui/Dialog';
import { IconButton } from './ui/Primitives';

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
    ? 'is-danger'
    : 'is-warning';
}

function notificationUsagePercent(notification: BudgetNotification) {
  if (notification.budget <= 0) return 0;
  return Math.min(100, Math.max(0, (notification.spent / notification.budget) * 100));
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useFocusTrap<HTMLElement>(open, { onEscape: () => setOpen(false) });
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
    refetchInterval: isSupabaseConfigured && Boolean(familyId)
      ? REMOTE_TRANSACTION_REFRESH_INTERVAL_MS
      : false,
    refetchOnWindowFocus: true,
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
    result.newNotifications
      .filter((notification) => notification.kind === 'over')
      .slice(0, 3)
      .forEach((notification) => {
        notify(notificationMessage(notification, language), 'error');
      });
  }, [familyId, language, notify, summary]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !containerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open, panelRef]);

  if (!familyId) return null;

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const readCount = notifications.length - unreadCount;
  const attentionCount = unreadCount + dueTransactions.length;
  const hasCriticalAlert = notifications.some((notification) => notification.kind === 'over' && !notification.readAt);
  const notificationTitle = en ? 'Notifications' : 'Thông báo';
  const notificationButtonLabel = attentionCount > 0
    ? `${notificationTitle}, ${attentionCount} ${en ? 'items need attention' : 'mục cần chú ý'}`
    : notificationTitle;
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
        queryClient.invalidateQueries({ queryKey: ['asset-summary', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['budgets', familyId] }),
      ]);
    }
    if (confirmedCount > 0) notify(en ? `Confirmed ${confirmedCount} planned transaction(s).` : `Đã xác nhận ${confirmedCount} giao dịch dự kiến.`);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="icon-button relative"
        aria-label={notificationButtonLabel}
        aria-expanded={open}
        aria-controls="budget-notifications-panel"
        title={notificationTitle}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} aria-hidden="true" />
        {attentionCount > 0 && (
          <span
            className={`budget-notification-badge ${hasCriticalAlert ? 'is-alert' : ''}`}
            aria-hidden="true"
          >
            {attentionCount > 99 ? '99+' : attentionCount}
          </span>
        )}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <>
          <button type="button" className="budget-notifications-scrim" aria-label={t('closeNotification')} onClick={() => setOpen(false)} />
          <section
            id="budget-notifications-panel"
            role="dialog"
            ref={panelRef}
            aria-modal="true"
            tabIndex={-1}
            aria-labelledby="budget-notifications-title"
            aria-describedby="budget-notifications-description"
            className="budget-notifications-panel"
          >
            <span className="budget-notifications-handle" aria-hidden="true" />
            <div className="budget-notifications-header">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="budget-notifications-title-icon" aria-hidden="true"><Bell size={17} /></span>
                  <h2 id="budget-notifications-title" className="font-extrabold">{notificationTitle}</h2>
                </div>
                <p id="budget-notifications-description" className="mt-1 text-xs">
                  {attentionCount > 0 ? `${attentionCount} ${en ? 'items need attention' : 'mục cần chú ý'}` : t('allBudgetNotificationsRead')}
                </p>
              </div>
              <IconButton icon={X} label={t('closeNotification')} data-dialog-autofocus onClick={() => setOpen(false)} />
            </div>

            <div className="budget-notifications-summary" aria-label={en ? 'Notification summary' : 'Tóm tắt thông báo'}>
              <span className={`budget-notifications-summary-chip ${unreadCount > 0 ? 'is-active' : ''}`}>
                <span className="budget-notifications-summary-count">{unreadCount}</span>
                {en ? 'Unread' : 'Chưa đọc'}
              </span>
              {dueTransactions.length > 0 && <span className="budget-notifications-summary-chip is-warning">
                <CalendarClock size={14} aria-hidden="true" />
                <span className="budget-notifications-summary-count">{dueTransactions.length}</span>
                {en ? 'To confirm' : 'Cần xác nhận'}
              </span>}
              {readCount > 0 && <span className="budget-notifications-summary-chip">
                <span className="budget-notifications-summary-count">{readCount}</span>
                {en ? 'Read' : 'Đã đọc'}
              </span>}
            </div>

            <div className="budget-notifications-scroll" role="region" aria-label={en ? 'Notification list' : 'Danh sách thông báo'}>
              {dueTransactions.length > 0 && <section className="budget-notifications-section budget-notifications-section-priority" aria-labelledby="budget-due-title">
                <div className="budget-notifications-section-heading">
                  <div>
                    <h3 id="budget-due-title">{en ? 'Planned transactions due' : 'Giao dịch dự kiến tới hạn'}</h3>
                    <p>{en ? `${dueTransactions.length} transaction(s) need confirmation.` : `${dueTransactions.length} giao dịch cần xác nhận.`}</p>
                  </div>
                  {dueTransactions.length > 1 && <button type="button" className="btn-primary budget-notifications-confirm-all" disabled={Boolean(confirmingId)} onClick={() => void confirmDueTransactions(dueTransactions)}>
                    {en ? 'Confirm all' : 'Xác nhận tất cả'}
                  </button>}
                </div>
                {dueError && <p role="alert" className="budget-notification-error">{dueError}</p>}
                <ul aria-label={en ? 'Due planned transactions' : 'Danh sách giao dịch dự kiến tới hạn'} className="budget-notifications-due-list">
                  {dueTransactions.map((transaction) => <li key={transaction.id} className="budget-notification-due-item">
                    <span className="budget-notification-due-icon" aria-hidden="true"><CalendarClock size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{transaction.description}</p>
                      <p className="budget-notification-meta">{formatDueDate(transaction.transactionDate, language)} · {formatMoney(transaction.amount, language)}</p>
                    </div>
                    <button type="button" className="budget-notification-action" disabled={Boolean(confirmingId)} onClick={() => void confirmDueTransactions([transaction])}>
                      {confirmingId === transaction.id ? (en ? 'Confirming…' : 'Đang xác nhận…') : (en ? 'Confirm' : 'Xác nhận')}
                    </button>
                  </li>)}
                </ul>
                {dueTransactions.length > 5 && <p className="budget-notification-hint">{en ? `Scroll to view all ${dueTransactions.length} transactions.` : `Cuộn để xem tất cả ${dueTransactions.length} giao dịch.`}</p>}
              </section>}

              <section className="budget-notifications-section" aria-labelledby="budget-alerts-title">
                {visibleNotifications.length > 0 && <div className="budget-notifications-section-heading">
                  <div>
                    <h3 id="budget-alerts-title">{en ? 'Budget alerts' : 'Cảnh báo ngân sách'}</h3>
                    <p>{en ? 'Keep an eye on spending limits.' : 'Theo dõi các khoản chi đang gần giới hạn.'}</p>
                  </div>
                  <span className="budget-notifications-section-count">{visibleNotifications.length}</span>
                </div>}
                {visibleNotifications.length > 0 ? (
                  <ul className="budget-notifications-list">
                    {visibleNotifications.map((notification) => {
                      const name = language === 'en'
                        ? notification.purposeNameEn || notification.purposeName
                        : notification.purposeName;
                      const Icon = notification.kind === 'over' ? CircleAlert : TriangleAlert;
                      const usagePercent = notificationUsagePercent(notification);
                      return (
                        <li key={notification.id}>
                          <Link
                            to={buildBudgetFilterLink(notification.purposeId, notification.year, notification.month)}
                            className={`budget-notification-item ${notificationTone(notification)} ${notification.readAt ? 'is-read' : 'is-unread'}`}
                            onClick={() => { markRead(notification.id); setOpen(false); }}
                          >
                            <span className="budget-notification-item-icon" aria-hidden="true"><Icon size={17} /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="budget-notification-item-label">{notificationLabel(notification, language)}</p>
                                  <p className="budget-notification-item-title">{name}</p>
                                </div>
                                {!notification.readAt && <span className="budget-notification-unread" aria-label={t('unreadBudgetNotification')} />}
                              </div>
                              <p className="budget-notification-message">{notificationMessage(notification, language)}</p>
                              <div className="budget-notification-progress" aria-hidden="true"><span style={{ width: `${usagePercent}%` }} /></div>
                              <p className="budget-notification-meta">{formatPeriod(notification, language)} · {t('viewTransactions')}</p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="budget-notifications-empty">
                    <span className="budget-notifications-empty-icon" aria-hidden="true"><CheckCircle2 size={22} /></span>
                    <p>{t('noBudgetNotifications')}</p>
                    <span>{en ? 'New alerts will appear here.' : 'Cảnh báo mới sẽ xuất hiện tại đây.'}</span>
                  </div>
                )}
              </section>
            </div>

            {(unreadCount > 0 || readCount > 0) && <div className="budget-notifications-footer">
              {unreadCount > 0 && <button type="button" className="budget-notifications-footer-action" onClick={markAllRead}>
                {t('markAllRead')}
              </button>}
              {readCount > 0 && <button type="button" className="budget-notifications-footer-action is-danger" onClick={deleteRead}>
                <Trash2 size={14} aria-hidden="true" />
                {t('deleteRead')}
              </button>}
            </div>}
          </section>
        </>,
        document.body,
      )}
    </div>
  );
}

import { Bell, Check, CircleAlert, TriangleAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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

function formatMoney(value: number, language: 'vi' | 'en') {
  return `${Math.round(value).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN')} ₫`;
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
  const app = useApp();
  const familyId = app.familyId;
  const purposes = app.purposes ?? emptyCatalogItems;
  const transactions = app.transactions ?? emptyTransactions;
  const { language, t } = useOptionalLanguage();
  const { notify } = useFeedback();
  const [open, setOpen] = useState(false);
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
  const visibleNotifications = notifications.slice(0, 12);
  const markRead = (id: string) => {
    markBudgetNotificationRead(id);
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  };
  const markAllRead = () => {
    const next = markAllBudgetNotificationsRead(familyId);
    setNotifications(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="icon-button relative"
        aria-label={t('budgetNotifications')}
        aria-expanded={open}
        aria-controls="budget-notifications-panel"
        title={t('budgetNotifications')}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid min-w-5 -translate-y-1/4 translate-x-1/4 place-items-center rounded-full bg-[#ff5555] px-1 text-[10px] font-extrabold leading-5 text-white"
            aria-label={`${unreadCount} ${t('unreadBudgetNotifications')}`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          id="budget-notifications-panel"
          role="dialog"
          aria-label={t('budgetNotifications')}
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-[#6272a466] dark:bg-[#343746]"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 dark:border-[#6272a466]">
            <div>
              <h2 className="font-extrabold">{t('budgetNotifications')}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
                {unreadCount > 0 ? `${unreadCount} ${t('unreadBudgetNotifications')}` : t('allBudgetNotificationsRead')}
              </p>
            </div>
            {unreadCount > 0 && (
              <button type="button" className="text-xs font-bold text-purple-700 hover:underline dark:text-[#bd93f9]" onClick={markAllRead}>
                {t('markAllRead')}
              </button>
            )}
          </div>
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

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CalendarDays,
  PiggyBank,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, PageSkeleton } from '../components/AsyncStates';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { dashboardSummaryResponseSchema } from '../lib/ai';
import { aiErrorMessage, invokeAiFunction } from '../lib/aiClient';
import { buildLocalBudgetSummary, formatBudgetInput, type BudgetSummary } from '../lib/budget';
import { fetchBudgetSummary } from '../lib/budgetsApi';
import { formatCompactVnd, formatVnd, getCatalogDisplayName, type CatalogItem, type CatalogLanguage, type Transaction } from '../lib/domain';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchDashboardTransactions,
  fetchTransactionYears,
} from '../lib/transactionsApi';

type DashboardMode = 'month' | '6m' | '12m' | 'year' | 'custom';
type Period = { key: string; label: string };
type DateRange = { from: string; to: string };
type Tone = 'emerald' | 'rose' | 'sky' | 'violet';

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, '0'),
  label: `Tháng ${index + 1}`,
}));
const englishMonthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];
const modeLabels: Record<DashboardMode, { vi: string; en: string }> = {
  month: { vi: 'Tháng', en: 'Month' },
  '6m': { vi: '6 tháng', en: '6 months' },
  '12m': { vi: '12 tháng', en: '12 months' },
  year: { vi: 'Năm', en: 'Year' },
  custom: { vi: 'Tùy chỉnh', en: 'Custom' },
};

const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const currentMonthKey = () => todayKey().slice(0, 7);

const addMonths = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthStart = (monthKey: string) => `${monthKey}-01`;

const monthEnd = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 1970, month || 1, 0));
  return date.toISOString().slice(0, 10);
};

const dateFromDaysBefore = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const monthPeriods = (fromKey: string, toKey: string): Period[] => {
  if (fromKey > toKey) return [];
  const periods: Period[] = [];
  let current = fromKey;
  while (current <= toKey && periods.length < 120) {
    const month = Number(current.slice(5, 7));
    periods.push({ key: current, label: `T${month}` });
    current = addMonths(current, 1);
  }
  return periods;
};

const periodsForMode = (
  anchorKey: string,
  mode: DashboardMode,
  customFrom: string,
  customTo: string,
) => {
  if (mode === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo) || customFrom > customTo)
      return [];
    return monthPeriods(customFrom.slice(0, 7), customTo.slice(0, 7));
  }
  if (mode === 'month') return monthPeriods(anchorKey, anchorKey);
  if (mode === 'year') {
    const year = anchorKey.slice(0, 4);
    return monthPeriods(`${year}-01`, `${year}-12`);
  }
  const count = mode === '12m' ? 12 : 6;
  return monthPeriods(addMonths(anchorKey, -(count - 1)), anchorKey);
};

const rangeForPeriods = (periods: Period[], customFrom = '', customTo = ''): DateRange => ({
  from: customFrom || (periods[0] ? monthStart(periods[0].key) : ''),
  to: customTo || (periods.length ? monthEnd(periods[periods.length - 1]!.key) : ''),
});

const rangeForPeriod = (period: Period, mode: DashboardMode, customFrom: string, customTo: string) => ({
  from: mode === 'custom' ? (customFrom > monthStart(period.key) ? customFrom : monthStart(period.key)) : monthStart(period.key),
  to: mode === 'custom' ? (customTo < monthEnd(period.key) ? customTo : monthEnd(period.key)) : monthEnd(period.key),
});

const previousRange = (periods: Period[], mode: DashboardMode, customFrom: string, customTo: string): DateRange => {
  if (mode === 'custom' && customFrom && customTo) {
    const duration = Math.round((new Date(`${customTo}T00:00:00Z`).getTime() - new Date(`${customFrom}T00:00:00Z`).getTime()) / 86_400_000);
    const to = dateFromDaysBefore(customFrom, 1);
    return { from: dateFromDaysBefore(to, duration), to };
  }
  const first = periods[0]?.key;
  if (!first) return { from: '', to: '' };
  const previousEnd = addMonths(first, -1);
  const previousStart = addMonths(first, -periods.length);
  return { from: monthStart(previousStart), to: monthEnd(previousEnd) };
};

const formatPercent = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Math.abs(value));

const changePercent = (current: number, previous: number) =>
  previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100;

const isIncome = (type: Transaction['transactionType']) =>
  type === 'Thu nhập';

const isExpense = (type: Transaction['transactionType']) =>
  type === 'Chi tiêu';

const incomeValue = (transaction: Transaction) => (isIncome(transaction.transactionType) ? transaction.amount : 0);

const expenseValue = (transaction: Transaction) => {
  if (isExpense(transaction.transactionType)) return transaction.amount;
  return 0;
};

const sumIncome = (transactions: Transaction[]) => transactions.reduce((total, item) => total + incomeValue(item), 0);
const sumExpense = (transactions: Transaction[]) => transactions.reduce((total, item) => total + (isExpense(item.transactionType) ? item.amount : 0), 0);

const transactionInRange = (transaction: Transaction, range: DateRange) =>
  Boolean(range.from && range.to && transaction.transactionDate >= range.from && transaction.transactionDate <= range.to);

function groupTransactions(
  transactions: Transaction[],
  items: CatalogItem[],
  key: 'purposeId' | 'expenseTypeId',
  valueFor: (transaction: Transaction) => number,
  language: CatalogLanguage,
) {
  const grouped = new Map<string, { id: string; name: string; value: number }>();
  transactions.forEach((transaction) => {
    const value = valueFor(transaction);
    if (!value) return;
    const id = transaction[key];
    const catalog = items.find((item) => item.id === id);
    const itemId = id || 'uncategorized';
    const current = grouped.get(itemId) || { id: itemId, name: getCatalogDisplayName(catalog, language) || (language === 'en' ? 'Uncategorized' : 'Chưa phân loại'), value: 0 };
    current.value += value;
    grouped.set(itemId, current);
  });
  return [...grouped.values()]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({ ...item, fill: chartColors[index % chartColors.length] || 'var(--chart-1)' }));
}

type ExpenseChartItem = { id: string; name: string; value: number; fill: string };
type PieChartItem = ExpenseChartItem & { isOther?: boolean; hiddenItems?: ExpenseChartItem[] };

const pieLabelMinPercent = 0.05;
const pieMaxSlices = 6;

export const formatPieLabel = ({ percent, value }: Pick<PieLabelRenderProps, 'percent' | 'value'>) => Number(percent) >= pieLabelMinPercent ? formatCompactVnd(Number(value)).replace(' ₫', '') : null;

export const summarizePieData = (data: ExpenseChartItem[], language: CatalogLanguage = 'vi'): PieChartItem[] => {
  const sorted = data.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= pieMaxSlices) return sorted;
  const visible = sorted.slice(0, pieMaxSlices - 1);
  const hiddenItems = sorted.slice(pieMaxSlices - 1);
  return [...visible, {
    id: 'other',
    name: language === 'en' ? 'Other' : 'Khác',
    value: hiddenItems.reduce((total, item) => total + item.value, 0),
    fill: '#94a3b8',
    isOther: true,
    hiddenItems,
  }];
};

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const { familyId, transactions, purposes, expenseTypes } = useApp();
  const currentMonth = currentMonthKey();
  const [currentYear, currentMonthNumber] = currentMonth.split('-');
  const [selectedYear, setSelectedYear] = useState(currentYear || '');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNumber || '01');
  const [mode, setMode] = useState<DashboardMode>('month');
  const [customFrom, setCustomFrom] = useState(`${currentMonth}-01`);
  const [customTo, setCustomTo] = useState(todayKey());
  const anchorKey = `${selectedYear}-${selectedMonth}`;
  const selectedPeriods = useMemo(() => periodsForMode(anchorKey, mode, customFrom, customTo), [anchorKey, mode, customFrom, customTo]);
  const selectedRange = useMemo(() => rangeForPeriods(selectedPeriods, mode === 'custom' ? customFrom : '', mode === 'custom' ? customTo : ''), [selectedPeriods, mode, customFrom, customTo]);
  const compareRange = useMemo(() => previousRange(selectedPeriods, mode, customFrom, customTo), [selectedPeriods, mode, customFrom, customTo]);
  const chartPeriods = useMemo(() => mode === 'month' ? periodsForMode(anchorKey, '6m', '', '') : selectedPeriods, [anchorKey, mode, selectedPeriods]);
  const chartRange = useMemo(() => rangeForPeriods(chartPeriods, mode === 'custom' ? customFrom : '', mode === 'custom' ? customTo : ''), [chartPeriods, mode, customFrom, customTo]);
  const validRange = selectedPeriods.length > 0;
  const hasMultiMonthView = selectedPeriods.length > 1;
  const queryFrom = [selectedRange.from, compareRange.from, chartRange.from].filter(Boolean).sort()[0] || '';
  const queryTo = selectedRange.to || '';
  const localAvailableYears = useMemo(() => Array.from(new Set([
    currentYear,
    ...transactions.map((transaction) => transaction.transactionDate.slice(0, 4)).filter((year) => /^\d{4}$/.test(year)),
  ])).sort((a, b) => Number(b) - Number(a)), [currentYear, transactions]);
  const yearsQuery = useQuery({
    queryKey: ['transaction-years', familyId],
    queryFn: () => fetchTransactionYears(familyId),
    enabled: isSupabaseConfigured && Boolean(familyId),
    staleTime: 5 * 60_000,
  });
  const dashboardQuery = useQuery({
    queryKey: ['dashboard-data', familyId, queryFrom, queryTo],
    queryFn: () => fetchDashboardTransactions(familyId, queryFrom, queryTo),
    enabled: isSupabaseConfigured && Boolean(familyId) && validRange,
  });
  const budgetQuery = useQuery({
    queryKey: ['budgets', familyId, Number(selectedYear), Number(selectedMonth)],
    queryFn: () => fetchBudgetSummary(familyId, Number(selectedYear), Number(selectedMonth)),
    enabled: isSupabaseConfigured && Boolean(familyId),
    retry: false,
    staleTime: 60_000,
  });
  const availableYears = isSupabaseConfigured
    ? Array.from(new Set([currentYear, ...(yearsQuery.data || [])])).sort((a, b) => Number(b) - Number(a))
    : localAvailableYears;
  const sourceTransactions = isSupabaseConfigured
    ? dashboardQuery.data || []
    : transactions.filter((transaction) => !transaction.deletedAt && transaction.status === 'Thực tế' && transactionInRange(transaction, { from: queryFrom, to: queryTo }));
  const selectedTransactions = sourceTransactions.filter((transaction) => transactionInRange(transaction, selectedRange));
  const comparisonTransactions = sourceTransactions.filter((transaction) => transactionInRange(transaction, compareRange));
  const selectedExpense = sumExpense(selectedTransactions);
  const selectedIncome = sumIncome(selectedTransactions);
  const comparisonExpense = sumExpense(comparisonTransactions);
  const comparisonIncome = sumIncome(comparisonTransactions);
  const expenseChange = changePercent(selectedExpense, comparisonExpense);
  const incomeChange = changePercent(selectedIncome, comparisonIncome);
  const byPurpose = groupTransactions(selectedTransactions, purposes, 'purposeId', expenseValue, language);
  const byExpenseType = groupTransactions(selectedTransactions, expenseTypes, 'expenseTypeId', expenseValue, language);
  const incomeByPurpose = groupTransactions(selectedTransactions, purposes, 'purposeId', incomeValue, language);
  const incomeByExpenseType = groupTransactions(selectedTransactions, expenseTypes, 'expenseTypeId', incomeValue, language);
  const trend = chartPeriods.map((period) => {
    const periodRange = rangeForPeriod(period, mode, customFrom, customTo);
    const periodTransactions = sourceTransactions.filter((transaction) => transactionInRange(transaction, periodRange));
    const expense = sumExpense(periodTransactions);
    const income = sumIncome(periodTransactions);
    return { ...period, expense, income, net: income - expense };
  });
  const periodCount = Math.max(selectedPeriods.length, 1);
  const averageExpense = selectedExpense / periodCount;
  const highestMonth = trend.reduce((highest, item) => item.expense > highest.expense ? item : highest, trend[0] || { key: '', label: '', expense: 0, income: 0, net: 0 });
  const lowestMonth = trend.filter((item) => item.expense > 0).reduce((lowest, item) => item.expense < lowest.expense ? item : lowest, highestMonth);
  const periodLabel = mode === 'month'
    ? `${en ? 'Month' : 'Tháng'} ${selectedMonth}/${selectedYear}`
    : mode === 'year'
      ? `${en ? 'Year' : 'Năm'} ${selectedYear}`
      : mode === 'custom'
        ? (validRange ? `${formatDate(customFrom)} – ${formatDate(customTo)}` : (en ? 'Invalid custom range' : 'Khoảng tùy chỉnh không hợp lệ'))
        : `${modeLabels[mode][en ? 'en' : 'vi']} ${en ? 'to' : 'đến'} T${selectedMonth}/${selectedYear}`;
  const periodFilterLink = (type?: string, range = selectedRange) => {
    if (mode === 'month') {
      const targetMonth = range.from ? range.from.slice(0, 7) : anchorKey;
      return `/giao-dich?${type ? `transactionType=${type}&` : ''}month=${targetMonth.slice(5, 7)}&year=${targetMonth.slice(0, 4)}`;
    }
    const params = new URLSearchParams();
    if (type) params.set('transactionType', type);
    params.set('dateFrom', range.from);
    params.set('dateTo', range.to);
    return `/giao-dich?${params.toString()}`;
  };
  const budgetSummary = isSupabaseConfigured
    ? budgetQuery.data
    : buildLocalBudgetSummary(purposes, transactions, Number(selectedYear), Number(selectedMonth));
  const topCategories = byExpenseType.slice(0, 5).map((item) => ({
    ...item,
    trend: chartPeriods.map((period) => {
      const periodRange = rangeForPeriod(period, mode, customFrom, customTo);
      return sourceTransactions
        .filter((transaction) => transactionInRange(transaction, periodRange) && transaction.expenseTypeId === item.id)
        .reduce((total, transaction) => total + expenseValue(transaction), 0);
    }),
    previousValue: comparisonTransactions.filter((transaction) => transaction.expenseTypeId === item.id).reduce((total, transaction) => total + expenseValue(transaction), 0),
  }));
  const insightTrend = mode === 'month' ? [] : trend;
  const insights = buildInsights({
    en,
    topCategories,
    highestMonth: mode === 'month' ? { key: '', expense: 0 } : highestMonth,
    lowestMonth: mode === 'month' ? { key: '', expense: 0 } : lowestMonth,
    expenseChange,
    selectedExpense,
    trend: insightTrend,
  });
  const error = dashboardQuery.isError || yearsQuery.isError;
  const aiSummaryQueryKey = [
    'ai-dashboard-summary',
    familyId,
    selectedRange.from,
    selectedRange.to,
    periodLabel,
    language,
  ] as const;
  const fetchAiSummary = async ({ signal }: { signal: AbortSignal }) => {
    const data = await invokeAiFunction<unknown>('summarize-dashboard', {
      familyId,
      dateFrom: selectedRange.from,
      dateTo: selectedRange.to,
      periodLabel,
      language,
      timezone: 'Asia/Ho_Chi_Minh',
    }, signal);
    const response = dashboardSummaryResponseSchema.safeParse(data);
    if (!response.success) throw new Error('AI_RESPONSE_INVALID');
    return response.data;
  };
  const aiSummaryQuery = useQuery({
    queryKey: aiSummaryQueryKey,
    queryFn: fetchAiSummary,
    enabled: false,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const aiSummaryBusy = aiSummaryQuery.isFetching;

  const chooseMode = (nextMode: DashboardMode) => {
    setMode(nextMode);
    if (nextMode === 'custom' && customTo < customFrom) setCustomTo(customFrom);
  };
  const changeMonth = (event: ChangeEvent<HTMLSelectElement>) => setSelectedMonth(event.target.value);
  const changeYear = (event: ChangeEvent<HTMLSelectElement>) => setSelectedYear(event.target.value);
  const runAiSummary = async () => {
    if (!isSupabaseConfigured || !familyId || !validRange || aiSummaryBusy) return;
    try {
      await queryClient.fetchQuery({
        queryKey: aiSummaryQueryKey,
        queryFn: fetchAiSummary,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: false,
      });
    } catch {
      // The query keeps the error so the UI can offer an explicit retry.
    }
  };
  if (isSupabaseConfigured && dashboardQuery.isPending)
    return <PageSkeleton label={en ? 'Loading financial overview…' : 'Đang tải tổng quan tài chính…'} />;

  return (
    <div className="dashboard-page space-y-5">
      <header className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="page-kicker"><BarChart3 size={16} aria-hidden="true" />{en ? 'Family spending analytics' : 'Phân tích chi tiêu gia đình'}</p>
          <h2 className="page-title">{en ? 'Financial overview' : 'Tổng quan tài chính'}</h2>
          <p className="page-subtitle">{en ? 'See what changed and where the money went.' : 'Theo dõi điều gì đã thay đổi và tiền đang đi đâu.'}</p>
        </div>
      </header>

      <section className="card dashboard-controls space-y-4 p-4 sm:p-5" aria-label={en ? 'Dashboard period controls' : 'Bộ lọc kỳ Dashboard'}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="period-switcher flex min-w-0 max-w-full flex-nowrap gap-1 overflow-x-auto overscroll-x-contain rounded-xl p-1" role="group" aria-label={en ? 'View periods' : 'Kỳ xem'}>
            {(Object.keys(modeLabels) as DashboardMode[]).map((item) => <button key={item} type="button" aria-pressed={mode === item} className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold transition sm:px-3 ${mode === item ? 'bg-[#155e46] text-white shadow-sm hover:bg-[#0f4b38] dark:bg-[#bd93f9] dark:text-[#282a36] dark:hover:bg-[#a779ed]' : 'text-gray-600 hover:text-[#155e46] dark:text-gray-300 dark:hover:text-[#bd93f9]'}`} onClick={() => chooseMode(item)}>{modeLabels[item][en ? 'en' : 'vi']}</button>)}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <label className="min-w-0"><span className="label">{en ? 'Month' : 'Tháng'}</span><select id="dashboard-month" aria-label={en ? 'Month' : 'Tháng'} className="field px-2 sm:min-w-32" value={selectedMonth} onChange={changeMonth}>{monthOptions.map((option) => <option key={option.value} value={option.value}>{en ? englishMonthNames[Number(option.value) - 1] : option.label}</option>)}</select></label>
            <label className="min-w-0"><span className="label">{en ? 'Year' : 'Năm'}</span><select id="dashboard-year" aria-label={en ? 'Year' : 'Năm'} className="field px-2 sm:min-w-28" value={selectedYear} onChange={changeYear}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          </div>
        </div>
        {mode === 'custom' && <div className="ui-enter grid gap-3 sm:grid-cols-2"><label htmlFor="dashboard-custom-from"><span className="label">{en ? 'From date' : 'Từ ngày'}</span><input id="dashboard-custom-from" className="field" type="date" value={customFrom} onInput={(event) => setCustomFrom(event.currentTarget.value)} onChange={(event) => setCustomFrom(event.currentTarget.value)} /></label><label htmlFor="dashboard-custom-to"><span className="label">{en ? 'To date' : 'Đến ngày'}</span><input id="dashboard-custom-to" className="field" type="date" value={customTo} onInput={(event) => setCustomTo(event.currentTarget.value)} onChange={(event) => setCustomTo(event.currentTarget.value)} /></label></div>}
        <div className="period-context flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><CalendarDays size={16} aria-hidden="true" /><span className="font-semibold text-gray-700 dark:text-gray-200">{periodLabel}</span><span aria-hidden="true">·</span><span>{en ? 'Actual transactions only' : 'Chỉ giao dịch thực tế'}</span></div>
      </section>

      {(!validRange || error) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{!validRange ? (en ? 'Choose a valid date range.' : 'Vui lòng chọn khoảng ngày hợp lệ.') : (en ? 'Could not load part of the dashboard. Please try again.' : 'Không thể tải một phần Dashboard. Vui lòng thử lại.')}</p>}

      {!budgetQuery.isError && <BudgetSnapshot summary={budgetSummary} en={en} month={selectedMonth} year={selectedYear} />}

      <section className={`ui-stagger dashboard-kpi-grid grid grid-cols-2 gap-3 sm:gap-4 ${hasMultiMonthView ? 'xl:grid-cols-6' : 'xl:grid-cols-3'}`} aria-label={en ? 'Financial summary' : 'Tóm tắt tài chính'}>
        <Kpi label={en ? 'Total income' : 'Tổng thu'} value={selectedIncome} icon={ArrowDownToLine} tone="emerald" meta={renderChange(incomeChange, en, 'vs previous period')} to={periodFilterLink('Thu nhập')} />
        <Kpi label={en ? 'Total expenses' : 'Tổng chi'} value={selectedExpense} icon={ArrowUpFromLine} tone="rose" meta={renderChange(expenseChange, en, 'vs previous period')} to={periodFilterLink('Chi tiêu')} />
        <div className={hasMultiMonthView ? 'min-w-0' : 'col-span-2 min-w-0 xl:col-span-1'}><Kpi label={en ? 'Net value' : 'Giá trị ròng'} value={selectedIncome - selectedExpense} icon={Scale} tone={selectedIncome >= selectedExpense ? 'emerald' : 'rose'} meta={en ? 'Income minus expenses' : 'Thu nhập trừ chi tiêu'} to={periodFilterLink()} /></div>
        {hasMultiMonthView && <>
          <Kpi label={en ? 'Average / month' : 'Trung bình / tháng'} value={averageExpense} icon={BarChart3} tone="sky" meta={en ? `${periodCount} mo.` : `${periodCount} tháng`} to={periodFilterLink('Chi tiêu')} />
          <Kpi label={en ? 'Peak month' : 'Tháng cao nhất'} value={highestMonth.expense} icon={TrendingUp} tone="violet" meta={highestMonth.expense > 0 ? `T${highestMonth.key.slice(5, 7)}/${highestMonth.key.slice(0, 4)}` : (en ? 'No data' : 'Chưa có dữ liệu')} to={periodFilterLink('Chi tiêu', highestMonth.expense > 0 ? rangeForPeriods([{ key: highestMonth.key, label: highestMonth.label }]) : selectedRange)} />
          <Kpi label={en ? 'Lowest month' : 'Tháng thấp nhất'} value={lowestMonth.expense} icon={TrendingDown} tone="sky" meta={lowestMonth.expense > 0 ? `T${lowestMonth.key.slice(5, 7)}/${lowestMonth.key.slice(0, 4)}` : (en ? 'No data' : 'Chưa có dữ liệu')} to={periodFilterLink('Chi tiêu', lowestMonth.expense > 0 ? rangeForPeriods([{ key: lowestMonth.key, label: lowestMonth.label }]) : selectedRange)} />
        </>}
      </section>


      <section className="card dashboard-chart-card min-w-0 overflow-hidden p-4 sm:p-5" aria-labelledby="dashboard-trend-title"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 id="dashboard-trend-title" className="text-lg font-bold">{en ? 'Spending and income trend' : 'Xu hướng thu chi'}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{mode === 'month' ? (en ? 'Six months ending in the selected month' : 'Sáu tháng kết thúc tại tháng đang chọn') : (en ? 'Monthly breakdown for this view' : 'Phân bổ theo từng tháng trong kỳ xem')}</p></div><div className="text-right text-sm"><p className="font-bold text-[#d96f4f]">{formatVnd(selectedExpense)}</p><p className="text-gray-500">{en ? 'expenses in view' : 'chi trong kỳ xem'}</p></div></div><div className="h-80 min-w-0 max-w-full">{trend.some((item) => item.expense || item.income) ? <ResponsiveContainer><ComposedChart data={trend} margin={{ top: 20, right: 12, left: 4, bottom: 6 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis tickFormatter={(value) => formatCompactVnd(Number(value)).replace(' ₫', '')} width={54} /><Tooltip labelFormatter={(label) => formatPeriodKey(String(trend.find((item) => item.label === label)?.key || ''), en)} formatter={(value) => formatVnd(Number(value))} /><Legend verticalAlign="top" align="right" /><Bar name={en ? 'Expenses' : 'Chi tiêu'} dataKey="expense" fill="#d96f4f" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(_, index) => { const period = trend[index]; if (period) navigate(`/giao-dich?transactionType=Chi tiêu&month=${period.key.slice(5, 7)}&year=${period.key.slice(0, 4)}`); }}><LabelList dataKey="expense" position="top" formatter={(value) => Number(value) > 0 ? formatCompactVnd(Number(value)).replace(' ₫', '') : ''} /></Bar><Line name={en ? 'Income' : 'Thu nhập'} type="monotone" dataKey="income" stroke="#155e46" strokeWidth={3} dot={{ r: 4 }} /><Line name={en ? 'Net value' : 'Thu ròng'} type="monotone" dataKey="net" stroke="#247df2" strokeWidth={2} strokeDasharray="5 5" dot={false} /></ComposedChart></ResponsiveContainer> : <EmptyState title={en ? 'No trend data' : 'Chưa có dữ liệu xu hướng'} description={en ? 'The trend will appear when the selected period has actual transactions.' : 'Xu hướng sẽ xuất hiện khi kỳ đang chọn có giao dịch thực tế.'} />}</div></section>

      <section className="ui-stagger grid gap-4 lg:grid-cols-2"><div className="card dashboard-pie-card min-w-0 overflow-hidden p-4 sm:p-5"><ExpensePieChart title={en ? 'Expenses by purpose' : 'Chi tiêu theo mục đích'} data={byPurpose} to={periodFilterLink()} filterKey="purposeId" en={en} /></div><div className="card dashboard-pie-card min-w-0 overflow-hidden p-4 sm:p-5"><ExpensePieChart title={en ? 'Expenses by category' : 'Chi tiêu theo danh mục'} data={byExpenseType} to={periodFilterLink()} filterKey="expenseTypeId" en={en} /></div></section>

      <section className="card dashboard-breakdown-card min-w-0 overflow-hidden p-4 sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{en ? 'Top categories over time' : 'Top danh mục theo thời gian'}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{en ? 'Click a row to inspect the filtered transactions.' : 'Bấm vào một dòng để xem các giao dịch đã lọc.'}</p></div><TrendingUp className="text-[#247df2]" size={22} aria-hidden="true" /></div>{topCategories.length ? <div className="space-y-2">{topCategories.map((item) => <Link key={item.id} to={`${periodFilterLink(undefined)}&expenseTypeId=${encodeURIComponent(item.id)}`} className="card-interactive grid grid-cols-[minmax(0,1fr)_minmax(120px,1.6fr)_auto] items-center gap-3 rounded-xl border border-black/5 p-3 hover:bg-black/[.025] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#137050] dark:border-white/10 dark:hover:bg-white/5"><div className="min-w-0"><p className="truncate font-semibold">{item.name}</p><p className="text-xs text-gray-500">{formatVnd(item.value)}</p></div><MiniTrend values={item.trend} label={`${item.name}: ${formatVnd(item.value)}`} /><ChangeBadge value={changePercent(item.value, item.previousValue)} en={en} /></Link>)}</div> : <div className="rounded-xl bg-black/[.025] px-4 py-7 text-center text-sm text-gray-500 dark:bg-white/[.04]">{en ? 'No category data in this period.' : 'Chưa có dữ liệu danh mục trong kỳ này.'}</div>}</section>

      <section className="ui-stagger grid gap-4 lg:grid-cols-2"><div className="card dashboard-pie-card min-w-0 overflow-hidden p-4 sm:p-5"><ExpensePieChart title={en ? 'Income by purpose' : 'Thu nhập theo mục đích'} data={incomeByPurpose} to={periodFilterLink('Thu nhập')} filterKey="purposeId" en={en} income /></div><div className="card dashboard-pie-card min-w-0 overflow-hidden p-4 sm:p-5"><ExpensePieChart title={en ? 'Income by category' : 'Thu nhập theo danh mục'} data={incomeByExpenseType} to={periodFilterLink('Thu nhập')} filterKey="expenseTypeId" en={en} income /></div></section>

      <section className="card attention-card border-amber-200 bg-amber-50/60 p-4 sm:p-5 dark:border-amber-900/60 dark:bg-amber-950/20" aria-labelledby="dashboard-insights-title"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Sparkles size={19} className="text-amber-600" aria-hidden="true" /><h3 id="dashboard-insights-title" className="font-bold">{en ? 'What stands out' : 'Điểm đáng chú ý'}</h3></div><button type="button" className="btn-secondary inline-flex shrink-0 items-center gap-2 text-sm" disabled={!isSupabaseConfigured || !validRange || aiSummaryBusy} onClick={() => void runAiSummary()} title={!isSupabaseConfigured ? (en ? 'Connect Supabase to use AI' : 'Cần kết nối Supabase để dùng AI') : undefined}><Sparkles size={16} aria-hidden="true" />{aiSummaryBusy ? (en ? 'Summarizing…' : 'Đang tóm tắt…') : aiSummaryQuery.isError ? (en ? 'Retry AI summary' : 'Thử lại tóm tắt AI') : (en ? 'Summarize with AI' : 'Tóm tắt bằng AI')}</button></div>{insights.length ? <ul className="grid gap-2 text-sm sm:grid-cols-2">{insights.map((insight) => <li key={insight} className="rounded-xl border border-amber-100 bg-white/70 p-3 dark:border-amber-900/40 dark:bg-white/5">{insight}</li>)}</ul> : <p className="text-sm text-gray-600 dark:text-gray-300">{en ? 'Insights will appear when there is enough actual data.' : 'Nhận xét sẽ xuất hiện khi có đủ dữ liệu giao dịch thực tế.'}</p>}{aiSummaryQuery.isError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-100/70 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"><span>{aiErrorMessage(aiSummaryQuery.error, en, 'summary')}</span><button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void runAiSummary()}>{en ? 'Retry' : 'Thử lại'}</button></div>}{aiSummaryQuery.data && <div className="mt-3 rounded-xl border border-amber-200 bg-white/75 p-3 text-sm dark:border-amber-900/60 dark:bg-white/5"><p className="leading-6">{aiSummaryQuery.data.summary}</p>{aiSummaryQuery.data.highlights.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300">{aiSummaryQuery.data.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>}</div>}</section>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatPeriodKey(value: string, en: boolean) {
  if (!value) return en ? 'No data' : 'Chưa có dữ liệu';
  return `${en ? 'Month' : 'Tháng'} ${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function renderChange(value: number | null, en: boolean, suffix: string) {
  if (value === null) return en ? 'No comparison data' : 'Chưa có kỳ so sánh';
  if (value === 0) return `${en ? 'No change' : 'Không đổi'} · ${en ? suffix : 'so với kỳ trước'}`;
  const direction = value > 0 ? (en ? 'Up' : 'Tăng') : (en ? 'Down' : 'Giảm');
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  const fullText = `${direction} ${formatPercent(value)}% · ${en ? suffix : 'so với kỳ trước'}`;
  return <span className="inline-flex min-w-0 items-center gap-1" aria-label={fullText}><Icon size={13} aria-hidden="true" /><span>{formatPercent(value)}%</span><span className="sr-only"> · {en ? suffix : 'so với kỳ trước'}</span></span>;
}

function BudgetSnapshot({ summary, en, month, year }: { summary?: BudgetSummary; en: boolean; month: string; year: string }) {
  if (!summary) return null;
  const hasBudgets = summary.budgetCount > 0;
  const statusText = summary.overCount > 0
    ? (en ? `${summary.overCount} over budget` : `${summary.overCount} mục đã vượt`)
    : summary.warningCount > 0
      ? (en ? `${summary.warningCount} near the limit` : `${summary.warningCount} mục sắp vượt`)
      : (en ? 'All set budgets are within limits' : 'Các mục đã đặt đều trong hạn mức');
  return <section className="card budget-snapshot border-[#bd93f966] bg-[#bd93f90d] p-4 dark:bg-[#bd93f90d] sm:p-5" aria-labelledby="dashboard-budget-title"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-[#bd93f91f] dark:text-[#bd93f9]"><PiggyBank size={20} aria-hidden="true" /></span><div className="min-w-0"><h3 id="dashboard-budget-title" className="font-extrabold">{en ? 'Monthly budget' : 'Ngân sách tháng'}</h3><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{hasBudgets ? `${formatBudgetInput(summary.budgetedSpent)} ₫ / ${formatBudgetInput(summary.totalBudget)} ₫` : (en ? 'No budget set for this month.' : 'Tháng này chưa đặt ngân sách.')}</p></div></div><Link className="btn-secondary inline-flex items-center justify-center text-sm" to="/ngan-sach">{en ? 'View budgets' : 'Xem ngân sách'}</Link></div>{hasBudgets && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300"><span>{statusText}</span>{summary.unbudgetedSpent > 0 && <span>{en ? `${formatBudgetInput(summary.unbudgetedSpent)} ₫ without a budget` : `${formatBudgetInput(summary.unbudgetedSpent)} ₫ chưa có ngân sách`}</span>}<span>{en ? `for ${month}/${year}` : `tháng ${month}/${year}`}</span></div>}</section>;
}

function buildInsights({
  en,
  topCategories,
  highestMonth,
  lowestMonth,
  expenseChange,
  selectedExpense,
  trend,
}: {
  en: boolean;
  topCategories: Array<ExpenseChartItem & { trend: number[]; previousValue: number }>;
  highestMonth: { key: string; expense: number };
  lowestMonth: { key: string; expense: number };
  expenseChange: number | null;
  selectedExpense: number;
  trend: Array<{ key: string; expense: number; income: number; net: number }>;
}) {
  const insights: string[] = [];
  const top = topCategories[0];
  if (top) insights.push(en ? `${top.name} is the largest category at ${formatVnd(top.value)}.` : `${top.name} là danh mục chi nhiều nhất với ${formatVnd(top.value)}.`);
  if (highestMonth?.key && highestMonth.expense > 0) insights.push(en ? `${formatPeriodKey(highestMonth.key, true)} has the highest spending in view.` : `${formatPeriodKey(highestMonth.key, false)} có mức chi cao nhất trong kỳ xem.`);
  if (lowestMonth?.key && lowestMonth.expense > 0 && lowestMonth.key !== highestMonth.key) insights.push(en ? `${formatPeriodKey(lowestMonth.key, true)} has the lowest spending in view.` : `${formatPeriodKey(lowestMonth.key, false)} có mức chi thấp nhất trong kỳ xem.`);
  if (expenseChange !== null && selectedExpense > 0) insights.push(en ? `Expenses are ${expenseChange >= 0 ? 'up' : 'down'} ${formatPercent(expenseChange)}% versus the previous period.` : `Chi tiêu ${expenseChange >= 0 ? 'tăng' : 'giảm'} ${formatPercent(expenseChange)}% so với kỳ trước.`);
  const recent = trend.slice(-3);
  if (recent.length >= 3 && recent.every((item, index) => index === 0 || item.expense >= recent[index - 1]!.expense) && recent[recent.length - 1]!.expense > recent[0]!.expense)
    insights.push(en ? 'Spending has risen for three consecutive points.' : 'Chi tiêu tăng trong ba mốc liên tiếp.');
  return insights.slice(0, 4);
}

function ChangeBadge({ value, en }: { value: number | null; en: boolean }) {
  if (value === null) return <span className="whitespace-nowrap text-xs text-gray-500">—</span>;
  const up = value > 0;
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold ${up ? 'text-rose-600 dark:text-rose-300' : value < 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}>{up ? <TrendingUp size={14} aria-hidden="true" /> : value < 0 ? <TrendingDown size={14} aria-hidden="true" /> : null}{value === 0 ? (en ? 'No change' : 'Không đổi') : `${value > 0 ? '+' : '-'}${formatPercent(value)}%`}</span>;
}

function MiniTrend({ values, label }: { values: number[]; label: string }) {
  const width = 180;
  const height = 42;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * width},${height - ((value - min) / span) * (height - 6) - 3}`).join(' ');
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full min-w-0 text-[var(--chart-net)]" role="img" aria-label={label}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ExpensePieChart({ title, data, to, filterKey, en, income = false }: { title: string; data: ExpenseChartItem[]; to: string; filterKey: 'purposeId' | 'expenseTypeId'; en: boolean; income?: boolean }) {
  const navigate = useNavigate();
  const pieData = summarizePieData(data, en ? 'en' : 'vi');
  const otherItem = pieData.find((item) => item.isOther);
  const openItem = (item: PieChartItem) => { if (item.id && item.id !== 'uncategorized' && !item.isOther) navigate(`${to}&${filterKey}=${encodeURIComponent(item.id)}`); };
  return <><h3 className="font-bold">{title}</h3><div className="min-h-72 min-w-0 max-w-full pt-3">{pieData.length ? <><div className="h-56 sm:h-64"><ResponsiveContainer><PieChart margin={{ top: 18, right: 18, left: 18, bottom: 0 }}><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} labelLine={false} label={formatPieLabel}>{pieData.map((item) => <Cell key={item.id || item.name} fill={item.fill} cursor={item.id !== 'uncategorized' && !item.isOther ? 'pointer' : undefined} role={item.id !== 'uncategorized' ? 'button' : undefined} tabIndex={item.id !== 'uncategorized' && !item.isOther ? 0 : undefined} aria-label={item.isOther ? `${item.name}: ${formatVnd(item.value)} (${item.hiddenItems?.length || 0} danh mục)` : `${item.name}: ${formatVnd(item.value)}`} onClick={() => openItem(item)} onKeyDown={(event) => { if (item.id !== 'uncategorized' && !item.isOther && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openItem(item); } }} />)}</Pie><Tooltip content={<PieTooltip />} /></PieChart></ResponsiveContainer></div><ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3" aria-label={`${title} legend`}>{pieData.map((item) => <li key={item.id || item.name} className="flex min-w-0 items-center gap-1.5"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} aria-hidden="true" /><span className="truncate" title={`${item.name}: ${formatVnd(item.value)}`}>{item.name}</span></li>)}</ul>{otherItem && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{en ? `${otherItem.hiddenItems?.length || 0} smaller categories grouped into “Other”; tap or click “Other” to see details.` : `${otherItem.hiddenItems?.length || 0} danh mục nhỏ được gộp vào “Khác”; nhấn hoặc bấm “Khác” để xem chi tiết.`}</p>}</> : <EmptyState title={en ? 'No chart data' : 'Chưa có dữ liệu biểu đồ'} description={en ? `No actual ${income ? 'income' : 'expense'} transactions in this period.` : `Chưa có giao dịch thực tế ${income ? 'thu nhập' : 'chi tiêu'} trong kỳ này.`} />}</div></>;
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: PieChartItem; value?: number }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#343746]"><p className="font-bold">{item.name}: {formatVnd(item.value)}</p>{item.hiddenItems?.length ? <ul className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-300">{item.hiddenItems.map((hiddenItem) => <li key={hiddenItem.id}>{hiddenItem.name}: {formatVnd(hiddenItem.value)}</li>)}</ul> : null}</div>;
}

function Kpi({ label, value, icon: Icon, tone, meta, to }: { label: string; value: number; icon: LucideIcon; tone: Tone; meta: ReactNode; to: string }) {
  const toneClass = tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-[#50fa7b1f] dark:text-[#50fa7b]' : tone === 'rose' ? 'bg-rose-100 text-rose-700 dark:bg-[#ff79c61f] dark:text-[#ff79c6]' : tone === 'violet' ? 'bg-violet-100 text-violet-700 dark:bg-[#bd93f91f] dark:text-[#bd93f9]' : 'bg-sky-100 text-sky-700 dark:bg-[#8be9fd1f] dark:text-[#8be9fd]';
  return <Link to={to} className="card card-interactive kpi-card group block h-full min-w-0 p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#137050] dark:focus-visible:ring-[#bd93f9] sm:p-4" aria-label={`Mở giao dịch theo ${label}`}><div className="min-w-0"><div className="flex items-center gap-2"><span className={`kpi-icon grid size-9 shrink-0 place-items-center rounded-xl ${toneClass}`}><Icon size={18} aria-hidden="true" /></span><p className="min-h-8 min-w-0 flex-1 text-xs font-semibold leading-4 text-gray-500 dark:text-gray-400">{label}</p></div><p className="kpi-value mt-2 max-w-full break-words whitespace-normal text-lg font-extrabold leading-tight sm:text-xl" title={formatVnd(value)} aria-label={`${label}: ${formatVnd(value)}`}>{formatCompactVnd(value)}</p></div><p className="kpi-meta mt-3 flex min-w-0 items-center gap-1 truncate text-xs leading-4">{meta}</p></Link>;
}

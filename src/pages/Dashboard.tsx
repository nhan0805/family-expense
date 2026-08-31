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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CalendarDays,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, PageSkeleton } from '../components/AsyncStates';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { formatCompactVnd, formatVnd, type CatalogItem, type Transaction } from '../lib/domain';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchDashboardDueTransactions,
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
const chartColors = ['#155e46', '#e6b85c', '#d97757', '#6081a8', '#7b6aa2', '#2c8a83'];
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
  type === 'Thu nhập' || type === 'Hoàn tiền';

const isExpense = (type: Transaction['transactionType']) =>
  type === 'Chi tiêu' || type === 'Tạm ứng';

const incomeValue = (transaction: Transaction) => (isIncome(transaction.transactionType) ? transaction.amount : 0);

const expenseValue = (transaction: Transaction) => {
  if (isExpense(transaction.transactionType)) return transaction.amount;
  if (transaction.transactionType === 'Hoàn tiền') return -transaction.amount;
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
) {
  const grouped = new Map<string, { id: string; name: string; value: number }>();
  transactions.forEach((transaction) => {
    const value = valueFor(transaction);
    if (!value) return;
    const id = transaction[key];
    const catalog = items.find((item) => item.id === id);
    const itemId = id || 'uncategorized';
    const current = grouped.get(itemId) || { id: itemId, name: catalog?.name || 'Chưa phân loại', value: 0 };
    current.value += value;
    grouped.set(itemId, current);
  });
  return [...grouped.values()]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({ ...item, fill: chartColors[index % chartColors.length] || '#155e46' }));
}

type ExpenseChartItem = { id: string; name: string; value: number; fill: string };

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const { familyId, transactions, purposes, expenseTypes, confirmPlannedTransaction } = useApp();
  const currentMonth = currentMonthKey();
  const [currentYear, currentMonthNumber] = currentMonth.split('-');
  const [selectedYear, setSelectedYear] = useState(currentYear || '');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNumber || '01');
  const [mode, setMode] = useState<DashboardMode>('month');
  const [customFrom, setCustomFrom] = useState(`${currentMonth}-01`);
  const [customTo, setCustomTo] = useState(todayKey());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [dueError, setDueError] = useState('');
  const anchorKey = `${selectedYear}-${selectedMonth}`;
  const selectedPeriods = useMemo(() => periodsForMode(anchorKey, mode, customFrom, customTo), [anchorKey, mode, customFrom, customTo]);
  const selectedRange = useMemo(() => rangeForPeriods(selectedPeriods, mode === 'custom' ? customFrom : '', mode === 'custom' ? customTo : ''), [selectedPeriods, mode, customFrom, customTo]);
  const compareRange = useMemo(() => previousRange(selectedPeriods, mode, customFrom, customTo), [selectedPeriods, mode, customFrom, customTo]);
  const chartPeriods = useMemo(() => mode === 'month' ? periodsForMode(anchorKey, '6m', '', '') : selectedPeriods, [anchorKey, mode, selectedPeriods]);
  const chartRange = useMemo(() => rangeForPeriods(chartPeriods, mode === 'custom' ? customFrom : '', mode === 'custom' ? customTo : ''), [chartPeriods, mode, customFrom, customTo]);
  const validRange = selectedPeriods.length > 0;
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
  const dueQuery = useQuery({
    queryKey: ['dashboard-due', familyId],
    queryFn: () => fetchDashboardDueTransactions(familyId, todayKey()),
    enabled: isSupabaseConfigured && Boolean(familyId),
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
  const byPurpose = groupTransactions(selectedTransactions, purposes, 'purposeId', expenseValue);
  const byExpenseType = groupTransactions(selectedTransactions, expenseTypes, 'expenseTypeId', expenseValue);
  const incomeByPurpose = groupTransactions(selectedTransactions, purposes, 'purposeId', incomeValue);
  const incomeByExpenseType = groupTransactions(selectedTransactions, expenseTypes, 'expenseTypeId', incomeValue);
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
  const dueTransactions = isSupabaseConfigured ? dueQuery.data || [] : transactions
    .filter((transaction) => !transaction.deletedAt && transaction.status === 'Dự kiến' && transaction.transactionDate <= todayKey())
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
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
  const insights = buildInsights({ en, topCategories, highestMonth, lowestMonth, expenseChange, selectedExpense, trend });
  const error = dashboardQuery.isError || dueQuery.isError || yearsQuery.isError;

  const chooseMode = (nextMode: DashboardMode) => {
    setMode(nextMode);
    if (nextMode === 'custom' && customTo < customFrom) setCustomTo(customFrom);
  };
  const changeMonth = (event: ChangeEvent<HTMLSelectElement>) => setSelectedMonth(event.target.value);
  const changeYear = (event: ChangeEvent<HTMLSelectElement>) => setSelectedYear(event.target.value);
  const confirmDueTransaction = async (id: string, description: string) => {
    if (!window.confirm(en ? `Confirm “${description}” as actual?` : `Xác nhận giao dịch “${description}” đã phát sinh thực tế?`)) return;
    setConfirmingId(id);
    setDueError('');
    const result = await confirmPlannedTransaction(id);
    setConfirmingId(null);
    if (result) setDueError(result);
    else if (isSupabaseConfigured) {
      await queryClient.invalidateQueries({ queryKey: ['dashboard-due', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-data', familyId] });
    }
  };

  if (isSupabaseConfigured && dashboardQuery.isPending)
    return <PageSkeleton label={en ? 'Loading financial overview…' : 'Đang tải tổng quan tài chính…'} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#155e46] dark:text-emerald-300"><BarChart3 size={17} aria-hidden="true" />{en ? 'Family spending analytics' : 'Phân tích chi tiêu gia đình'}</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{en ? 'Financial overview' : 'Tổng quan tài chính'}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'See what changed and where the money went.' : 'Theo dõi điều gì đã thay đổi và tiền đang đi đâu.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" aria-label={en ? 'Previous month' : 'Tháng trước'} onClick={() => { const previous = addMonths(anchorKey, -1); setSelectedYear(previous.slice(0, 4)); setSelectedMonth(previous.slice(5, 7)); setMode('month'); }}>{en ? 'Previous' : 'Trước'}</button>
          <button type="button" className="btn-secondary" aria-label={en ? 'Current month' : 'Tháng này'} onClick={() => { setSelectedYear(currentYear || ''); setSelectedMonth(currentMonthNumber || '01'); setMode('month'); }}>{en ? 'Now' : 'Nay'}</button>
        </div>
      </header>

      <section className="card space-y-4 p-4" aria-label={en ? 'Dashboard period controls' : 'Bộ lọc kỳ Dashboard'}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/5">
            {(Object.keys(modeLabels) as DashboardMode[]).map((item) => <button key={item} type="button" aria-pressed={mode === item} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === item ? 'bg-[#247df2] text-white shadow-sm' : 'hover:bg-white dark:hover:bg-white/10'}`} onClick={() => chooseMode(item)}>{modeLabels[item][en ? 'en' : 'vi']}</button>)}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <label className="min-w-0"><span className="label">{en ? 'Month' : 'Tháng'}</span><select id="dashboard-month" aria-label={en ? 'Month' : 'Tháng'} className="field bg-white px-2 dark:bg-[#17251f] sm:min-w-32" value={selectedMonth} onChange={changeMonth}>{monthOptions.map((option) => <option key={option.value} value={option.value}>{en ? englishMonthNames[Number(option.value) - 1] : option.label}</option>)}</select></label>
            <label className="min-w-0"><span className="label">{en ? 'Year' : 'Năm'}</span><select id="dashboard-year" aria-label={en ? 'Year' : 'Năm'} className="field bg-white px-2 dark:bg-[#17251f] sm:min-w-28" value={selectedYear} onChange={changeYear}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          </div>
        </div>
        {mode === 'custom' && <div className="grid gap-3 sm:grid-cols-2"><label htmlFor="dashboard-custom-from"><span className="label">{en ? 'From date' : 'Từ ngày'}</span><input id="dashboard-custom-from" className="field bg-white dark:bg-[#17251f]" type="date" value={customFrom} onInput={(event) => setCustomFrom(event.currentTarget.value)} onChange={(event) => setCustomFrom(event.currentTarget.value)} /></label><label htmlFor="dashboard-custom-to"><span className="label">{en ? 'To date' : 'Đến ngày'}</span><input id="dashboard-custom-to" className="field bg-white dark:bg-[#17251f]" type="date" value={customTo} onInput={(event) => setCustomTo(event.currentTarget.value)} onChange={(event) => setCustomTo(event.currentTarget.value)} /></label></div>}
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><CalendarDays size={16} aria-hidden="true" /><span>{periodLabel}</span><span aria-hidden="true">·</span><span>{en ? 'Actual transactions only' : 'Chỉ giao dịch thực tế'}</span></div>
      </section>

      {(!validRange || error) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{!validRange ? (en ? 'Choose a valid date range.' : 'Vui lòng chọn khoảng ngày hợp lệ.') : (en ? 'Could not load part of the dashboard. Please try again.' : 'Không thể tải một phần Dashboard. Vui lòng thử lại.')}</p>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6" aria-label={en ? 'Financial summary' : 'Tóm tắt tài chính'}>
        <Kpi label={en ? 'Total expenses' : 'Tổng chi'} value={selectedExpense} icon={ArrowUpFromLine} tone="rose" meta={renderChange(expenseChange, en, 'vs previous period')} to={periodFilterLink('Chi tiêu')} />
        <Kpi label={en ? 'Total income' : 'Tổng thu'} value={selectedIncome} icon={ArrowDownToLine} tone="emerald" meta={renderChange(incomeChange, en, 'vs previous period')} to={periodFilterLink('Thu nhập')} />
        <Kpi label={en ? 'Net value' : 'Giá trị ròng'} value={selectedIncome - selectedExpense} icon={Scale} tone={selectedIncome >= selectedExpense ? 'emerald' : 'rose'} meta={en ? 'Income minus expenses' : 'Thu nhập trừ chi tiêu'} to={periodFilterLink()} />
        <Kpi label={en ? 'Average / month' : 'Trung bình / tháng'} value={averageExpense} icon={BarChart3} tone="sky" meta={en ? `${periodCount} month${periodCount > 1 ? 's' : ''} in view` : `${periodCount} tháng trong kỳ xem`} to={periodFilterLink('Chi tiêu')} />
        <Kpi label={en ? 'Peak month' : 'Tháng cao nhất'} value={highestMonth.expense} icon={TrendingUp} tone="violet" meta={highestMonth.expense > 0 ? `T${highestMonth.key.slice(5, 7)}/${highestMonth.key.slice(0, 4)}` : (en ? 'No data' : 'Chưa có dữ liệu')} to={periodFilterLink('Chi tiêu', highestMonth.expense > 0 ? rangeForPeriods([{ key: highestMonth.key, label: highestMonth.label }]) : selectedRange)} />
        <Kpi label={en ? 'Lowest month' : 'Tháng thấp nhất'} value={lowestMonth.expense} icon={TrendingDown} tone="sky" meta={lowestMonth.expense > 0 ? `T${lowestMonth.key.slice(5, 7)}/${lowestMonth.key.slice(0, 4)}` : (en ? 'No data' : 'Chưa có dữ liệu')} to={periodFilterLink('Chi tiêu', lowestMonth.expense > 0 ? rangeForPeriods([{ key: lowestMonth.key, label: lowestMonth.label }]) : selectedRange)} />
      </section>

      {dueTransactions.length > 0 && <section className="card border-amber-300 p-4 dark:border-amber-700"><div className="mb-3"><h3 className="font-bold">{en ? 'Due planned transactions' : 'Giao dịch dự kiến đến hạn'}</h3><p className="text-sm text-gray-500">{en ? `${dueTransactions.length} transaction(s) need confirmation before they are included in actual reports.` : `${dueTransactions.length} giao dịch cần xác nhận trước khi tính vào báo cáo thực tế.`}</p></div>{dueError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{dueError}</p>}<div className="divide-y divide-black/10 dark:divide-white/10">{dueTransactions.map((transaction) => <div key={transaction.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-semibold">{transaction.description}</p><p className="text-xs text-gray-500">{en ? 'Due ' : 'Đến hạn '}{formatDate(transaction.transactionDate)} · {formatVnd(transaction.amount)}</p></div><button type="button" className="btn-primary shrink-0" disabled={confirmingId === transaction.id} onClick={() => void confirmDueTransaction(transaction.id, transaction.description)}>{confirmingId === transaction.id ? (en ? 'Confirming…' : 'Đang xác nhận…') : (en ? 'Confirm actual' : 'Xác nhận thực tế')}</button></div>)}</div></section>}

      <section className="card min-w-0 overflow-hidden p-4 sm:p-5" aria-labelledby="dashboard-trend-title"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 id="dashboard-trend-title" className="text-lg font-bold">{en ? 'Spending and income trend' : 'Xu hướng thu chi'}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{mode === 'month' ? (en ? 'Six months ending in the selected month' : 'Sáu tháng kết thúc tại tháng đang chọn') : (en ? 'Monthly breakdown for this view' : 'Phân bổ theo từng tháng trong kỳ xem')}</p></div><div className="text-right text-sm"><p className="font-bold text-[#d96f4f]">{formatVnd(selectedExpense)}</p><p className="text-gray-500">{en ? 'expenses in view' : 'chi trong kỳ xem'}</p></div></div><div className="h-80 min-w-0 max-w-full">{trend.some((item) => item.expense || item.income) ? <ResponsiveContainer><ComposedChart data={trend} margin={{ top: 20, right: 12, left: 4, bottom: 6 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis tickFormatter={(value) => formatCompactVnd(Number(value)).replace(' ₫', '')} width={54} /><Tooltip labelFormatter={(label) => formatPeriodKey(String(trend.find((item) => item.label === label)?.key || ''), en)} formatter={(value) => formatVnd(Number(value))} /><Legend verticalAlign="top" align="right" /><Bar name={en ? 'Expenses' : 'Chi tiêu'} dataKey="expense" fill="#d96f4f" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(_, index) => { const period = trend[index]; if (period) navigate(`/giao-dich?transactionType=Chi tiêu&month=${period.key.slice(5, 7)}&year=${period.key.slice(0, 4)}`); }}><LabelList dataKey="expense" position="top" formatter={(value) => Number(value) > 0 ? formatCompactVnd(Number(value)).replace(' ₫', '') : ''} /></Bar><Line name={en ? 'Income' : 'Thu nhập'} type="monotone" dataKey="income" stroke="#155e46" strokeWidth={3} dot={{ r: 4 }} /><Line name={en ? 'Net value' : 'Thu ròng'} type="monotone" dataKey="net" stroke="#247df2" strokeWidth={2} strokeDasharray="5 5" dot={false} /></ComposedChart></ResponsiveContainer> : <EmptyState title={en ? 'No trend data' : 'Chưa có dữ liệu xu hướng'} description={en ? 'The trend will appear when the selected period has actual transactions.' : 'Xu hướng sẽ xuất hiện khi kỳ đang chọn có giao dịch thực tế.'} />}</div></section>

      <section className="grid gap-4 lg:grid-cols-2"><div className="card min-w-0 overflow-hidden p-4"><ExpensePieChart title={en ? 'Expenses by purpose' : 'Chi tiêu theo mục đích'} data={byPurpose} to={periodFilterLink()} filterKey="purposeId" en={en} /></div><div className="card min-w-0 overflow-hidden p-4"><PackedBubbleChart title={en ? 'Expenses by category' : 'Chi tiêu theo danh mục'} data={byExpenseType} to={periodFilterLink()} filterKey="expenseTypeId" en={en} /></div></section>

      <section className="card min-w-0 overflow-hidden p-4 sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{en ? 'Top categories over time' : 'Top danh mục theo thời gian'}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{en ? 'Click a row to inspect the filtered transactions.' : 'Bấm vào một dòng để xem các giao dịch đã lọc.'}</p></div><TrendingUp className="text-[#247df2]" size={22} aria-hidden="true" /></div>{topCategories.length ? <div className="space-y-2">{topCategories.map((item) => <Link key={item.id} to={`${periodFilterLink(undefined)}&expenseTypeId=${encodeURIComponent(item.id)}`} className="grid grid-cols-[minmax(0,1fr)_minmax(120px,1.6fr)_auto] items-center gap-3 rounded-xl border border-black/5 p-3 hover:bg-black/[.025] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#137050] dark:border-white/10 dark:hover:bg-white/5"><div className="min-w-0"><p className="truncate font-semibold">{item.name}</p><p className="text-xs text-gray-500">{formatVnd(item.value)}</p></div><MiniTrend values={item.trend} label={`${item.name}: ${formatVnd(item.value)}`} /><ChangeBadge value={changePercent(item.value, item.previousValue)} en={en} /></Link>)}</div> : <div className="rounded-xl bg-black/[.025] px-4 py-7 text-center text-sm text-gray-500 dark:bg-white/[.04]">{en ? 'No category data in this period.' : 'Chưa có dữ liệu danh mục trong kỳ này.'}</div>}</section>

      <section className="grid gap-4 lg:grid-cols-2"><div className="card min-w-0 overflow-hidden p-4"><ExpensePieChart title={en ? 'Income by purpose' : 'Thu nhập theo mục đích'} data={incomeByPurpose} to={periodFilterLink('Thu nhập')} filterKey="purposeId" en={en} income /></div><div className="card min-w-0 overflow-hidden p-4"><PackedBubbleChart title={en ? 'Income by category' : 'Thu nhập theo danh mục'} data={incomeByExpenseType} to={periodFilterLink('Thu nhập')} filterKey="expenseTypeId" en={en} income /></div></section>

      <section className="card border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20" aria-labelledby="dashboard-insights-title"><div className="mb-3 flex items-center gap-2"><Sparkles size={19} className="text-amber-600" aria-hidden="true" /><h3 id="dashboard-insights-title" className="font-bold">{en ? 'What stands out' : 'Điểm đáng chú ý'}</h3></div>{insights.length ? <ul className="grid gap-2 text-sm sm:grid-cols-2">{insights.map((insight) => <li key={insight} className="rounded-lg bg-white/70 p-3 dark:bg-white/5">{insight}</li>)}</ul> : <p className="text-sm text-gray-600 dark:text-gray-300">{en ? 'Insights will appear when there is enough actual data.' : 'Nhận xét sẽ xuất hiện khi có đủ dữ liệu giao dịch thực tế.'}</p>}</section>
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
  return `${direction} ${formatPercent(value)}% · ${en ? suffix : 'so với kỳ trước'}`;
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
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full min-w-0 text-[#247df2]" role="img" aria-label={label}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ExpensePieChart({ title, data, to, filterKey, en, income = false }: { title: string; data: ExpenseChartItem[]; to: string; filterKey: 'purposeId' | 'expenseTypeId'; en: boolean; income?: boolean }) {
  const navigate = useNavigate();
  const openItem = (item: ExpenseChartItem) => { if (item.id && item.id !== 'uncategorized') navigate(`${to}&${filterKey}=${encodeURIComponent(item.id)}`); };
  return <><h3 className="font-bold">{title}</h3><div className="h-72 min-w-0 max-w-full overflow-hidden pt-3">{data.length ? <ResponsiveContainer><PieChart margin={{ top: 18, right: 18, left: 18, bottom: 0 }}><Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} labelLine label={({ value }) => formatCompactVnd(Number(value)).replace(' ₫', '')}>{data.map((item) => <Cell key={item.id || item.name} fill={item.fill} cursor={item.id !== 'uncategorized' ? 'pointer' : undefined} role={item.id !== 'uncategorized' ? 'button' : undefined} tabIndex={item.id !== 'uncategorized' ? 0 : undefined} aria-label={`${item.name}: ${formatVnd(item.value)}`} onClick={() => openItem(item)} onKeyDown={(event) => { if (item.id !== 'uncategorized' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openItem(item); } }} />)}</Pie><Tooltip formatter={(value) => formatVnd(Number(value))} /><Legend verticalAlign="bottom" iconType="circle" /></PieChart></ResponsiveContainer> : <EmptyState title={en ? 'No chart data' : 'Chưa có dữ liệu biểu đồ'} description={en ? `No actual ${income ? 'income' : 'expense'} transactions in this period.` : `Chưa có giao dịch thực tế ${income ? 'thu nhập' : 'chi tiêu'} trong kỳ này.`} />}</div></>;
}

function PackedBubbleChart({ title, data, to, filterKey, en, income = false }: { title: string; data: ExpenseChartItem[]; to: string; filterKey: 'purposeId' | 'expenseTypeId'; en: boolean; income?: boolean }) {
  const navigate = useNavigate();
  const bubbles = packBubbles(data.filter((item) => item.value > 0));
  const openItem = (item: ExpenseChartItem) => { if (item.id && item.id !== 'uncategorized') navigate(`${to}&${filterKey}=${encodeURIComponent(item.id)}`); };
  return <><h3 className="font-bold">{title}</h3><div className="h-72 min-w-0 max-w-full overflow-hidden pt-3">{bubbles.length ? <svg className="h-full w-full" viewBox="0 0 640 300" role="list" aria-label={title} preserveAspectRatio="xMidYMid meet">{bubbles.map((item) => { const shortName = item.name.length > 14 ? `${item.name.slice(0, 13)}…` : item.name; const showName = item.r >= 30; return <g key={item.id || item.name} role={item.id !== 'uncategorized' ? 'button' : undefined} tabIndex={item.id !== 'uncategorized' ? 0 : -1} aria-label={`${item.name}: ${formatVnd(item.value)}`} className="cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => openItem(item)} onKeyDown={(event) => { if (item.id !== 'uncategorized' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openItem(item); } }}><title>{`${item.name}: ${formatVnd(item.value)}`}</title><circle cx={item.x} cy={item.y} r={item.r} fill={item.fill} opacity="0.92" stroke="white" strokeWidth="2" />{showName && <text x={item.x} y={item.y - 3} textAnchor="middle" fill="white" fontSize={item.r >= 42 ? 14 : 11} fontWeight="700" pointerEvents="none">{shortName}</text>}{showName && <text x={item.x} y={item.y + 15} textAnchor="middle" fill="white" fontSize={item.r >= 42 ? 13 : 10} fontWeight="600" pointerEvents="none">{formatCompactVnd(item.value).replace(' ₫', '')}</text>}</g>; })}</svg> : <EmptyState title={en ? 'No chart data' : 'Chưa có dữ liệu biểu đồ'} description={en ? `No actual ${income ? 'income' : 'expense'} transactions in this period.` : `Chưa có giao dịch thực tế ${income ? 'thu nhập' : 'chi tiêu'} trong kỳ này.`} />}</div></>;
}

type PackedBubble = ExpenseChartItem & { x: number; y: number; r: number };

function packBubbles(data: ExpenseChartItem[]): PackedBubble[] {
  const width = 640;
  const height = 300;
  const padding = 12;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const maxRadius = data.length > 8 ? 52 : data.length > 5 ? 62 : 74;
  const minRadius = data.length > 1 ? 26 : 36;
  const placed: PackedBubble[] = [];
  data.slice().sort((a, b) => b.value - a.value).forEach((item, index) => {
    const radius = Math.max(minRadius, Math.sqrt(item.value / maxValue) * maxRadius);
    if (index === 0) { placed.push({ ...item, x: width / 2, y: height / 2, r: radius }); return; }
    let candidate: PackedBubble | null = null;
    for (let step = 0; step < 1600 && !candidate; step += 1) {
      const angle = step * 0.43;
      const distance = 18 + step * 1.45;
      const x = width / 2 + Math.cos(angle) * distance;
      const y = height / 2 + Math.sin(angle) * distance * 0.62;
      if (x - radius < padding || x + radius > width - padding || y - radius < padding || y + radius > height - padding) continue;
      if (placed.every((bubble) => Math.hypot(x - bubble.x, y - bubble.y) >= radius + bubble.r + 5)) candidate = { ...item, x, y, r: radius };
    }
    if (candidate) placed.push(candidate);
  });
  return placed;
}

function Kpi({ label, value, icon: Icon, tone, meta, to }: { label: string; value: number; icon: LucideIcon; tone: Tone; meta: string; to: string }) {
  const toneClass = tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : tone === 'rose' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : tone === 'violet' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300';
  return <Link to={to} className="card min-w-0 p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#137050] sm:p-4" aria-label={`Mở giao dịch theo ${label}`}><div className="flex items-start gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClass}`}><Icon size={18} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p><p className="mt-1 truncate text-base font-extrabold sm:text-xl" title={formatVnd(value)} aria-label={`${label}: ${formatVnd(value)}`}>{formatVnd(value)}</p></div></div><p className="mt-3 truncate text-xs text-gray-500 dark:text-gray-400" title={meta}>{meta}</p></Link>;
}

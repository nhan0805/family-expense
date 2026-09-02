import { AlertTriangle, CalendarDays, CheckCircle2, Copy, ExternalLink, PiggyBank, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, PageSkeleton } from '../components/AsyncStates';
import { useFeedback } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import {
  buildLocalBudgetSummary,
  budgetInputSchema,
  copyLocalBudgets,
  deleteLocalBudget,
  formatBudgetInput,
  parseBudgetInput,
  upsertLocalBudget,
  type BudgetSummaryItem,
  type BudgetStatus,
} from '../lib/budget';
import {
  buildBudgetFilterLink,
  copyBudgets,
  deleteBudget,
  fetchBudgetSummary,
  upsertBudget,
} from '../lib/budgetsApi';
import { isSupabaseConfigured } from '../lib/supabase';
import { userFacingError } from '../lib/errorRecovery';

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7);
};

const availableYearOptions = (currentYear: number, selectedYear: number, years: string[]) =>
  Array.from(new Set([
    ...Array.from({ length: 5 }, (_, index) => String(currentYear - 2 + index)),
    String(selectedYear),
    ...years,
  ])).sort((a, b) => Number(b) - Number(a));

const previousPeriod = (year: number, month: number) => {
  const value = new Date(Date.UTC(year, month - 2, 1));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
};

const amountForDisplay = (value: number | null) =>
  value === null ? '' : formatBudgetInput(value);

function statusLabel(status: BudgetStatus, en: boolean) {
  if (status === 'unconfigured') return en ? 'Not set' : 'Chưa đặt';
  if (status === 'warning') return en ? 'Near limit' : 'Sắp vượt';
  if (status === 'over') return en ? 'Over budget' : 'Đã vượt';
  return en ? 'Within budget' : 'Trong hạn mức';
}

function statusClass(status: BudgetStatus) {
  if (status === 'warning') return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-[#f1fa8c66] dark:bg-[#f1fa8c1f] dark:text-[#f1fa8c]';
  if (status === 'over') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-[#ff555566] dark:bg-[#ff55551f] dark:text-[#ff5555]';
  if (status === 'within') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-[#50fa7b66] dark:bg-[#50fa7b1f] dark:text-[#50fa7b]';
  return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-[#6272a466] dark:bg-[#44475a] dark:text-[#bdc0d0]';
}

function progressClass(status: BudgetStatus) {
  if (status === 'over') return 'bg-[#ff5555]';
  if (status === 'warning') return 'bg-[#f1fa8c]';
  if (status === 'within') return 'bg-[#50fa7b]';
  return 'bg-[#6272a4]';
}

function errorMessage(error: unknown, en: boolean, fallback: string) {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';
  if (raw.includes('forbidden') || raw.includes('42501'))
    return en ? 'You do not have permission to change budgets.' : 'Bạn không có quyền thay đổi ngân sách.';
  if (raw.includes('invalid_amount'))
    return en ? 'The budget amount is invalid.' : 'Số tiền ngân sách không hợp lệ.';
  if (raw.includes('invalid_warning_threshold'))
    return en ? 'The warning threshold is invalid.' : 'Ngưỡng cảnh báo không hợp lệ.';
  if (raw.includes('purpose_not_found'))
    return en ? 'This purpose is no longer available.' : 'Mục đích này không còn khả dụng.';
  return en ? fallback : userFacingError(error, fallback);
}

export function Budgets() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const { familyId, currentUserRole, purposes, transactions, online } = useApp();
  const { askConfirm, notify } = useFeedback();
  const queryClient = useQueryClient();
  const monthKey = currentMonth();
  const [selectedYear, setSelectedYear] = useState(Number(monthKey.slice(0, 4)));
  const [selectedMonth, setSelectedMonth] = useState(Number(monthKey.slice(5, 7)));
  const [, setLocalRevision] = useState(0);
  const [editorPurposeId, setEditorPurposeId] = useState<string | null>(null);
  const [editorAmount, setEditorAmount] = useState('');
  const [editorThreshold, setEditorThreshold] = useState('80');
  const [editorError, setEditorError] = useState('');
  const [savingPurposeId, setSavingPurposeId] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const canManage = currentUserRole === 'owner';
  const currentYear = Number(monthKey.slice(0, 4));
  const years = useMemo(
    () => Array.from(new Set(transactions.map((item) => item.transactionDate.slice(0, 4)).filter((item) => /^\d{4}$/.test(item)))),
    [transactions],
  );
  const yearOptions = useMemo(
    () => availableYearOptions(currentYear, selectedYear, years),
    [currentYear, selectedYear, years],
  );
  const localSummary = buildLocalBudgetSummary(purposes, transactions, selectedYear, selectedMonth);
  const summaryQuery = useQuery({
    queryKey: ['budgets', familyId, selectedYear, selectedMonth],
    queryFn: () => fetchBudgetSummary(familyId, selectedYear, selectedMonth),
    enabled: isSupabaseConfigured && Boolean(familyId),
    retry: false,
  });
  const summary = isSupabaseConfigured ? summaryQuery.data : localSummary;

  const monthLabel = new Intl.DateTimeFormat(en ? 'en-US' : 'vi-VN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(Date.UTC(selectedYear, selectedMonth - 1, 1)));

  const beginEdit = (item: BudgetSummaryItem) => {
    setEditorPurposeId(item.purposeId);
    setEditorAmount(amountForDisplay(item.budget));
    setEditorThreshold(String(Math.round(item.warningThreshold * 100)));
    setEditorError('');
  };

  const closeEdit = () => {
    setEditorPurposeId(null);
    setEditorAmount('');
    setEditorThreshold('80');
    setEditorError('');
  };

  const refreshSummary = async () => {
    if (isSupabaseConfigured) {
      await queryClient.invalidateQueries({
        queryKey: ['budgets', familyId, selectedYear, selectedMonth],
      });
    } else {
      setLocalRevision((value) => value + 1);
    }
  };

  const saveBudget = async (event: FormEvent<HTMLFormElement>, purposeId: string) => {
    event.preventDefault();
    const amount = parseBudgetInput(editorAmount);
    const thresholdPercent = Number(editorThreshold);
    const parsed = budgetInputSchema.safeParse({
      year: selectedYear,
      month: selectedMonth,
      purposeId,
      amount,
      warningThreshold: thresholdPercent / 100,
    });
    if (!parsed.success) {
      setEditorError(en ? 'Enter a valid amount and warning threshold.' : 'Vui lòng nhập số tiền và ngưỡng cảnh báo hợp lệ.');
      return;
    }
    if (isSupabaseConfigured && !online) {
      setEditorError(en ? 'You are offline. Reconnect before saving.' : 'Đang mất kết nối mạng. Hãy kết nối lại trước khi lưu.');
      return;
    }
    setSavingPurposeId(purposeId);
    setEditorError('');
    try {
      if (isSupabaseConfigured) await upsertBudget(familyId, parsed.data);
      else upsertLocalBudget(parsed.data);
      await refreshSummary();
      closeEdit();
      notify(en ? 'Budget saved.' : 'Đã lưu ngân sách.');
    } catch (error) {
      setEditorError(errorMessage(error, en, en ? 'Could not save the budget.' : 'Không thể lưu ngân sách.'));
    } finally {
      setSavingPurposeId(null);
    }
  };

  const removeBudget = async (item: BudgetSummaryItem) => {
    if (!item.budgetId && isSupabaseConfigured) return;
    if (!await askConfirm({
      title: en ? 'Delete this budget?' : 'Xóa ngân sách này?',
      description: en ? `The ${item.nameEn || item.name} budget for ${monthLabel} will be removed. Transactions will not be changed.` : `Ngân sách ${item.name} của ${monthLabel} sẽ bị xóa. Các giao dịch không bị thay đổi.`,
      confirmLabel: en ? 'Delete budget' : 'Xóa ngân sách',
      danger: true,
    })) return;
    if (isSupabaseConfigured && !online) {
      notify(en ? 'Reconnect before deleting a budget.' : 'Hãy kết nối lại trước khi xóa ngân sách.', 'error');
      return;
    }
    setDeletingBudgetId(item.budgetId || item.purposeId);
    try {
      if (isSupabaseConfigured) await deleteBudget(familyId, item.budgetId!);
      else deleteLocalBudget(item.budgetId!);
      await refreshSummary();
      if (editorPurposeId === item.purposeId) closeEdit();
      notify(en ? 'Budget deleted.' : 'Đã xóa ngân sách.');
    } catch (error) {
      setEditorError(errorMessage(error, en, en ? 'Could not delete the budget.' : 'Không thể xóa ngân sách.'));
    } finally {
      setDeletingBudgetId(null);
    }
  };

  const handleCopyPrevious = async () => {
    const source = previousPeriod(selectedYear, selectedMonth);
    if (isSupabaseConfigured && !online) {
      notify(en ? 'Reconnect before copying budgets.' : 'Hãy kết nối lại trước khi sao chép ngân sách.', 'error');
      return;
    }
    setCopying(true);
    try {
      const sourceSummary = isSupabaseConfigured
        ? await fetchBudgetSummary(familyId, source.year, source.month)
        : buildLocalBudgetSummary(purposes, transactions, source.year, source.month);
      if (!sourceSummary.budgetCount) {
        notify(en ? 'There are no budgets in the previous month.' : 'Tháng trước chưa có ngân sách để sao chép.', 'info');
        return;
      }
      const overwrite = summary?.budgetCount
        ? await askConfirm({
          title: en ? 'Replace this month’s budgets?' : 'Ghi đè ngân sách tháng này?',
          description: en ? `${summary.budgetCount} existing budget(s) will be replaced with values from ${source.year}/${String(source.month).padStart(2, '0')}.` : `${summary.budgetCount} ngân sách hiện có sẽ được thay bằng số liệu của ${source.month}/${source.year}.`,
          confirmLabel: en ? 'Copy budgets' : 'Sao chép ngân sách',
        })
        : true;
      if (!overwrite) return;
      const count = isSupabaseConfigured
        ? await copyBudgets(familyId, source.year, source.month, selectedYear, selectedMonth)
        : copyLocalBudgets(source.year, source.month, selectedYear, selectedMonth);
      await refreshSummary();
      notify(en ? `Copied ${count} budget(s).` : `Đã sao chép ${count} ngân sách.`);
    } catch (error) {
      notify(errorMessage(error, en, en ? 'Could not copy budgets.' : 'Không thể sao chép ngân sách.'), 'error');
    } finally {
      setCopying(false);
    }
  };

  if (isSupabaseConfigured && summaryQuery.isPending)
    return <PageSkeleton label={en ? 'Loading budgets…' : 'Đang tải ngân sách…'} />;

  if (isSupabaseConfigured && summaryQuery.isError)
    return <div className="space-y-5"><header className="page-header"><p className="page-kicker"><PiggyBank size={16} aria-hidden="true" />{en ? 'Family planning' : 'Lập kế hoạch gia đình'}</p><h2 className="page-title">{en ? 'Budgets' : 'Ngân sách'}</h2></header><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{errorMessage(summaryQuery.error, en, en ? 'Could not load budgets.' : 'Không thể tải ngân sách.')}</div></div>;

  return <div className="budgets-page space-y-5">
    <header className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="page-kicker"><PiggyBank size={16} aria-hidden="true" />{en ? 'Family planning' : 'Lập kế hoạch gia đình'}</p>
        <h2 className="page-title">{en ? 'Budgets' : 'Ngân sách'}</h2>
        <p className="page-subtitle">{canManage ? (en ? 'Set a monthly limit by purpose and track actual expenses.' : 'Đặt hạn mức theo mục đích và theo dõi chi tiêu thực tế từng tháng.') : (en ? 'View the family budget. Only the owner can make changes.' : 'Xem ngân sách gia đình. Chỉ chủ gia đình mới có quyền chỉnh sửa.')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={!canManage || copying || Boolean(isSupabaseConfigured && !online)} onClick={() => void handleCopyPrevious()}><Copy size={17} aria-hidden="true" />{copying ? (en ? 'Copying…' : 'Đang sao chép…') : (en ? 'Copy previous month' : 'Sao chép tháng trước')}</button>
      </div>
    </header>

    <section className="card dashboard-controls space-y-3 p-4 sm:p-5" aria-label={en ? 'Budget period controls' : 'Bộ lọc kỳ ngân sách'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><CalendarDays size={17} aria-hidden="true" /><span className="font-semibold text-gray-800 dark:text-gray-100">{monthLabel}</span><span aria-hidden="true">·</span><span>{en ? 'Actual expenses only' : 'Chỉ tính chi tiêu thực tế'}</span></div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <label className="min-w-0"><span className="label">{en ? 'Month' : 'Tháng'}</span><select className="field px-2 sm:min-w-32" aria-label={en ? 'Budget month' : 'Tháng ngân sách'} value={String(selectedMonth)} onChange={(event) => setSelectedMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{en ? new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(Date.UTC(2020, index, 1))) : `Tháng ${index + 1}`}</option>)}</select></label>
          <label className="min-w-0"><span className="label">{en ? 'Year' : 'Năm'}</span><select className="field px-2 sm:min-w-28" aria-label={en ? 'Budget year' : 'Năm ngân sách'} value={String(selectedYear)} onChange={(event) => setSelectedYear(Number(event.target.value))}>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        </div>
      </div>
    </section>

    {summary && <>
      <section className="budget-summary-grid grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={en ? 'Budget summary' : 'Tóm tắt ngân sách'}>
        <SummaryCard label={en ? 'Total budget' : 'Tổng ngân sách'} value={summary.totalBudget} tone="violet" />
        <SummaryCard label={en ? 'Budgeted spending' : 'Đã chi trong mục đã đặt'} value={summary.budgetedSpent} tone="rose" />
        <SummaryCard label={en ? 'Remaining' : 'Còn lại'} value={summary.totalRemaining} tone={summary.totalRemaining < 0 ? 'over' : 'emerald'} />
        <div className="card budget-summary-card p-3 sm:p-4"><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{en ? 'Attention' : 'Cần chú ý'}</p><p className="mt-2 text-lg font-extrabold sm:text-xl">{summary.overCount + summary.warningCount}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{en ? `${summary.overCount} over · ${summary.warningCount} near limit` : `${summary.overCount} đã vượt · ${summary.warningCount} sắp vượt`}</p></div>
      </section>

      {summary.unbudgetedSpent > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-[#f1fa8c66] dark:bg-[#f1fa8c1f] dark:text-[#f1fa8c]">{en ? `${formatBudgetInput(summary.unbudgetedSpent)} ₫ was spent in purposes without a budget.` : `${formatBudgetInput(summary.unbudgetedSpent)} ₫ đã chi ở các mục đích chưa đặt ngân sách.`}</p>}

      <section className="card overflow-hidden" aria-labelledby="budget-list-title">
        <div className="flex flex-col gap-2 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-white/10"><div><h3 id="budget-list-title" className="text-lg font-extrabold">{en ? 'Budget by purpose' : 'Ngân sách theo mục đích'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? `${summary.budgetCount} of ${summary.items.length} purposes have a budget.` : `${summary.budgetCount}/${summary.items.length} mục đích đã được đặt ngân sách.`}</p></div><span className="ui-chip">{en ? 'VND · monthly' : 'VND · theo tháng'}</span></div>
        {summary.items.length ? <div className="ui-stagger divide-y divide-black/10 dark:divide-white/10">{summary.items.map((item) => <BudgetRow key={item.purposeId} item={item} year={selectedYear} month={selectedMonth} en={en} canManage={canManage} editing={editorPurposeId === item.purposeId} editorAmount={editorPurposeId === item.purposeId ? editorAmount : ''} editorThreshold={editorPurposeId === item.purposeId ? editorThreshold : '80'} editorError={editorPurposeId === item.purposeId ? editorError : ''} saving={savingPurposeId === item.purposeId} deleting={deletingBudgetId === (item.budgetId || item.purposeId)} onBeginEdit={() => beginEdit(item)} onCloseEdit={closeEdit} onAmountChange={setEditorAmount} onThresholdChange={setEditorThreshold} onSubmit={saveBudget} onDelete={() => void removeBudget(item)} />)}</div> : <EmptyState title={en ? 'No purposes available' : 'Chưa có mục đích'} description={en ? 'Create a purpose before setting a budget.' : 'Hãy tạo mục đích trước khi đặt ngân sách.'} />}
      </section>
    </>}
  </div>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'violet' | 'rose' | 'emerald' | 'over' }) {
  const iconClass = tone === 'violet' ? 'dark:bg-[#bd93f91f] dark:text-[#bd93f9]' : tone === 'rose' ? 'dark:bg-[#ff79c61f] dark:text-[#ff79c6]' : tone === 'over' ? 'dark:bg-[#ff55551f] dark:text-[#ff5555]' : 'dark:bg-[#50fa7b1f] dark:text-[#50fa7b]';
  return <div className="card budget-summary-card p-3 sm:p-4"><span className={`mb-2 inline-flex size-8 items-center justify-center rounded-xl bg-gray-100 text-gray-600 ${iconClass}`}><PiggyBank size={16} aria-hidden="true" /></span><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p><p className="mt-1 break-words text-base font-extrabold sm:text-lg" title={formatBudgetInput(value)}>{formatBudgetInput(value)} ₫</p></div>;
}

type BudgetRowProps = {
  item: BudgetSummaryItem;
  year: number;
  month: number;
  en: boolean;
  canManage: boolean;
  editing: boolean;
  editorAmount: string;
  editorThreshold: string;
  editorError: string;
  saving: boolean;
  deleting: boolean;
  onBeginEdit: () => void;
  onCloseEdit: () => void;
  onAmountChange: (value: string) => void;
  onThresholdChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, purposeId: string) => void;
  onDelete: () => void;
};

function BudgetRow({ item, year, month, en, canManage, editing, editorAmount, editorThreshold, editorError, saving, deleting, onBeginEdit, onCloseEdit, onAmountChange, onThresholdChange, onSubmit, onDelete }: BudgetRowProps) {
  const displayName = en ? item.nameEn || item.name : item.name;
  const usage = item.usagePercent === null ? 0 : Math.max(0, Math.min(item.usagePercent, 100));
  const filterLink = buildBudgetFilterLink(item.purposeId, year, month);
  return <article className="budget-row p-4 sm:p-5">
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,1.25fr)_auto] lg:items-center lg:gap-5">
      <div className="min-w-0"><div className="flex items-start gap-3"><span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${item.status === 'over' ? 'bg-rose-100 text-rose-700 dark:bg-[#ff55551f] dark:text-[#ff5555]' : item.status === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-[#f1fa8c1f] dark:text-[#f1fa8c]' : 'bg-emerald-100 text-emerald-700 dark:bg-[#50fa7b1f] dark:text-[#50fa7b]'}`}><PiggyBank size={18} aria-hidden="true" /></span><div className="min-w-0"><h4 className="truncate font-bold" title={displayName}>{displayName}</h4><span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${statusClass(item.status)}`}>{item.status === 'over' ? <AlertTriangle size={13} className="mr-1" aria-hidden="true" /> : item.status === 'within' ? <CheckCircle2 size={13} className="mr-1" aria-hidden="true" /> : null}{statusLabel(item.status, en)}</span></div></div></div>
      <div className="min-w-0"><div className="flex items-end justify-between gap-3 text-sm"><span className="min-w-0 truncate text-gray-600 dark:text-gray-300">{item.budget === null ? (en ? 'No budget set' : 'Chưa đặt ngân sách') : <><strong>{formatBudgetInput(item.spent)} ₫</strong><span className="text-gray-500 dark:text-gray-400"> / {formatBudgetInput(item.budget)} ₫</span></>}</span><span className="shrink-0 font-bold text-gray-700 dark:text-gray-200">{item.usagePercent === null ? '—' : `${item.usagePercent.toLocaleString(en ? 'en-US' : 'vi-VN', { maximumFractionDigits: 1 })}%`}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-[#44475a]"><div className={`h-full rounded-full transition-all ${progressClass(item.status)}`} style={{ width: `${usage}%` }} /></div><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.budget === null ? (en ? `${formatBudgetInput(item.spent)} ₫ spent without a budget` : `Đã chi ${formatBudgetInput(item.spent)} ₫ nhưng chưa đặt ngân sách`) : item.remaining! < 0 ? (en ? `${formatBudgetInput(Math.abs(item.remaining!))} ₫ over` : `Vượt ${formatBudgetInput(Math.abs(item.remaining!))} ₫`) : (en ? `${formatBudgetInput(item.remaining!)} ₫ remaining` : `Còn ${formatBudgetInput(item.remaining!)} ₫`)}</p></div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end"><Link className="btn-secondary inline-flex items-center gap-1.5 text-sm" to={filterLink}><ExternalLink size={15} aria-hidden="true" />{en ? 'Transactions' : 'Giao dịch'}</Link>{canManage && <button type="button" className="btn-secondary text-sm" onClick={onBeginEdit}>{item.budget === null ? (en ? 'Set budget' : 'Đặt ngân sách') : (en ? 'Edit' : 'Sửa')}</button>}{canManage && item.budgetId && <button type="button" className="icon-button text-red-600 hover:bg-red-50 dark:text-[#ff5555] dark:hover:bg-[#ff55551f]" aria-label={en ? `Delete ${displayName} budget` : `Xóa ngân sách ${displayName}`} title={en ? 'Delete budget' : 'Xóa ngân sách'} disabled={deleting} onClick={onDelete}><Trash2 size={17} /></button>}</div>
    </div>
    {editing && <form className="budget-editor mt-4 rounded-2xl border border-black/10 bg-gray-50 p-3 dark:border-white/10 dark:bg-[#303241]" onSubmit={(event) => onSubmit(event, item.purposeId)}><div className="mb-3 flex items-center justify-between gap-3"><div><h5 className="font-bold">{item.budget === null ? (en ? 'Set monthly budget' : 'Đặt ngân sách tháng') : (en ? 'Edit monthly budget' : 'Sửa ngân sách tháng')}</h5><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{en ? 'Only actual expenses are counted.' : 'Chỉ chi tiêu thực tế được tính.'}</p></div><button type="button" className="icon-button" aria-label={en ? 'Close budget editor' : 'Đóng trình sửa ngân sách'} onClick={onCloseEdit}><X size={18} /></button></div><div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(150px,.6fr)]"><label><span className="label">{en ? 'Monthly amount (VND)' : 'Số tiền tháng (VND)'}</span><input className="field" type="text" inputMode="numeric" autoFocus required value={editorAmount} onChange={(event) => { const digits = event.target.value.replace(/\D/g, ''); onAmountChange(digits ? formatBudgetInput(Number(digits)) : ''); }} placeholder="15.000.000" aria-label={en ? `Budget amount for ${displayName}` : `Số tiền ngân sách ${displayName}`} /></label><label><span className="label">{en ? 'Warn at (%)' : 'Cảnh báo ở (%)'}</span><input className="field" type="number" min="1" max="100" step="1" required value={editorThreshold} onChange={(event) => onThresholdChange(event.target.value)} aria-label={en ? `Warning threshold for ${displayName}` : `Ngưỡng cảnh báo ${displayName}`} /></label></div>{editorError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{editorError}</p>}<div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end"><button type="button" className="btn-secondary inline-flex items-center justify-center gap-1.5" onClick={onCloseEdit}><X size={15} aria-hidden="true" />{en ? 'Cancel' : 'Hủy'}</button><button type="submit" className="btn-primary inline-flex items-center justify-center gap-1.5" disabled={saving}><Save size={15} aria-hidden="true" />{saving ? (en ? 'Saving…' : 'Đang lưu…') : (en ? 'Save budget' : 'Lưu ngân sách')}</button></div></form>}
  </article>;
}

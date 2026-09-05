import { CalendarClock, PauseCircle, Pencil, PlayCircle, Plus, RefreshCw, Repeat2, SkipForward, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState, PageSkeleton } from '../components/AsyncStates';
import { useFeedback } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { getCatalogDisplayName, formatDateOnlyVi, formatVnd } from '../lib/domain';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  generateDueRecurringTransactions,
  fetchRecurringExpenses,
  setRecurringExpenseActive,
  skipRecurringOccurrence,
  upsertRecurringExpense,
} from '../lib/recurringExpensesApi';
import {
  generateLocalDueTransactions,
  getLocalRecurringExpenses,
  recurringExpenseInputSchema,
  recurringFrequencies,
  setLocalRecurringExpenseActive,
  skipLocalRecurringOccurrence,
  todayInVietnam,
  upsertLocalRecurringExpense,
  type RecurringExpense,
  type RecurringFrequency,
} from '../lib/recurringExpense';
import { userFacingError } from '../lib/errorRecovery';

type EditorValues = {
  name: string;
  description: string;
  amount: string;
  purposeId: string;
  expenseTypeId: string;
  paymentMethodId: string;
  frequency: RecurringFrequency;
  nextRunDate: string;
  endDate: string;
  note: string;
};

const blankEditor = (paymentMethodId = ''): EditorValues => ({
  name: '',
  description: '',
  amount: '',
  purposeId: '',
  expenseTypeId: '',
  paymentMethodId,
  frequency: 'monthly',
  nextRunDate: todayInVietnam(),
  endDate: '',
  note: '',
});

const frequencyLabel = (frequency: RecurringFrequency, en: boolean) => {
  if (frequency === 'weekly') return en ? 'Weekly' : 'Hàng tuần';
  if (frequency === 'yearly') return en ? 'Yearly' : 'Hàng năm';
  return en ? 'Monthly' : 'Hàng tháng';
};

const inputAmount = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const displayAmount = (value: string) => inputAmount(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function recurringError(error: unknown, en: boolean, fallback: string) {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';
  if (raw.includes('forbidden') || raw.includes('42501')) return en ? 'Only the family owner can change recurring expenses.' : 'Chỉ chủ gia đình mới có quyền thay đổi khoản chi định kỳ.';
  if (raw.includes('invalid_name')) return en ? 'Enter a recurring expense name.' : 'Vui lòng nhập tên khoản chi định kỳ.';
  if (raw.includes('invalid_frequency')) return en ? 'This frequency is not supported.' : 'Tần suất này chưa được hỗ trợ.';
  if (raw.includes('purpose_not_found') || raw.includes('expense_type_not_found') || raw.includes('payment_method_not_found')) return en ? 'A selected category is no longer available.' : 'Một danh mục đã chọn không còn khả dụng.';
  if (raw.includes('generation_failed') || raw.includes('invalid_template')) return en ? 'The recurring template could not generate a transaction. Review its categories and try again.' : 'Mẫu định kỳ chưa thể tạo giao dịch. Hãy kiểm tra lại danh mục rồi thử lại.';
  return en ? fallback : userFacingError(error, fallback);
}

export function RecurringExpenses() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const {
    familyId,
    currentUserId,
    currentUserRole,
    purposes,
    expenseTypes,
    paymentMethods,
    transactions,
    setTransactions,
    online,
  } = useApp();
  const { askConfirm, notify } = useFeedback();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [editor, setEditor] = useState<EditorValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const canManage = currentUserRole === 'owner';
  const defaultPaymentMethodId = paymentMethods.find((item) => item.name === 'Chuyển khoản')?.id || paymentMethods[0]?.id || '';

  const loadItems = useCallback(async () => {
    if (!familyId) return;
    setLoading(true);
    setPageError('');
    try {
      if (isSupabaseConfigured) {
        setItems(await fetchRecurringExpenses(familyId));
      } else {
        const created = generateLocalDueTransactions(familyId, currentUserId, transactions);
        if (created.length) setTransactions((current) => [...current, ...created]);
        setItems(getLocalRecurringExpenses(familyId));
      }
    } catch (error) {
      setPageError(recurringError(error, en, en ? 'Could not load recurring expenses.' : 'Không thể tải khoản chi định kỳ.'));
    } finally {
      setLoading(false);
    }
  }, [currentUserId, en, familyId, setTransactions, transactions]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const purposeNames = useMemo(() => new Map(purposes.map((item) => [item.id, getCatalogDisplayName(item, language)])), [language, purposes]);
  const expenseTypeNames = useMemo(() => new Map(expenseTypes.map((item) => [item.id, getCatalogDisplayName(item, language)])), [expenseTypes, language]);
  const paymentMethodNames = useMemo(() => new Map(paymentMethods.map((item) => [item.id, getCatalogDisplayName(item, language)])), [language, paymentMethods]);
  const activeCount = items.filter((item) => item.active).length;
  const dueCount = items.filter((item) => item.active && item.nextRunDate <= todayInVietnam()).length;

  const openEditor = (item?: RecurringExpense) => {
    if (!item) {
      setEditingId(null);
      setEditor(blankEditor(defaultPaymentMethodId));
    } else {
      setEditingId(item.id);
      setEditor({
        name: item.name,
        description: item.template.description,
        amount: String(item.template.amount),
        purposeId: item.template.purposeId,
        expenseTypeId: item.template.expenseTypeId,
        paymentMethodId: item.template.paymentMethodId,
        frequency: item.frequency,
        nextRunDate: item.nextRunDate,
        endDate: item.endDate || '',
        note: item.template.note || '',
      });
    }
    setEditorError('');
  };

  const closeEditor = () => {
    setEditor(null);
    setEditingId(null);
    setEditorError('');
  };

  const refreshRelatedQueries = async () => {
    if (!isSupabaseConfigured) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['transaction-years', familyId] }),
    ]);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const parsed = recurringExpenseInputSchema.safeParse({
      name: editor.name,
      template: {
        transactionType: 'Chi tiêu',
        description: editor.description,
        amount: Number(inputAmount(editor.amount)),
        purposeId: editor.purposeId,
        expenseTypeId: editor.expenseTypeId,
        paymentMethodId: editor.paymentMethodId,
        note: editor.note.trim() || null,
      },
      frequency: editor.frequency,
      nextRunDate: editor.nextRunDate,
      endDate: editor.endDate || null,
    });
    if (!parsed.success) {
      setEditorError(parsed.error.issues[0]?.message || (en ? 'Review the form.' : 'Hãy kiểm tra lại biểu mẫu.'));
      return;
    }
    if (isSupabaseConfigured && !online) {
      setEditorError(en ? 'Reconnect before saving.' : 'Hãy kết nối lại trước khi lưu.');
      return;
    }
    setBusyId(editingId || 'new');
    setEditorError('');
    try {
      const saved = isSupabaseConfigured
        ? await upsertRecurringExpense(familyId, parsed.data, editingId || undefined)
        : upsertLocalRecurringExpense(familyId, parsed.data, editingId || undefined);
      setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => Number(b.active) - Number(a.active) || a.nextRunDate.localeCompare(b.nextRunDate)));
      closeEditor();
      notify(en ? 'Recurring expense saved.' : 'Đã lưu khoản chi định kỳ.');
    } catch (error) {
      setEditorError(recurringError(error, en, en ? 'Could not save the recurring expense.' : 'Không thể lưu khoản chi định kỳ.'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (item: RecurringExpense) => {
    if (!await askConfirm({
      title: item.active ? (en ? 'Pause this recurring expense?' : 'Tạm dừng khoản chi định kỳ?') : (en ? 'Resume this recurring expense?' : 'Tiếp tục khoản chi định kỳ?'),
      description: item.active ? (en ? 'No new planned transactions will be created while it is paused.' : 'Khi tạm dừng, hệ thống sẽ không tạo giao dịch dự kiến mới.') : (en ? 'Its next scheduled date will be kept.' : 'Ngày chạy tiếp theo sẽ được giữ nguyên.'),
      confirmLabel: item.active ? (en ? 'Pause' : 'Tạm dừng') : (en ? 'Resume' : 'Tiếp tục'),
    })) return;
    setBusyId(item.id);
    try {
      if (isSupabaseConfigured) await setRecurringExpenseActive(familyId, item.id, !item.active);
      else setLocalRecurringExpenseActive(familyId, item.id, !item.active);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, active: !item.active } : entry));
      notify(item.active ? (en ? 'Recurring expense paused.' : 'Đã tạm dừng khoản chi định kỳ.') : (en ? 'Recurring expense resumed.' : 'Đã tiếp tục khoản chi định kỳ.'));
    } catch (error) {
      notify(recurringError(error, en, en ? 'Could not update this recurring expense.' : 'Không thể cập nhật khoản chi định kỳ.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const skipNext = async (item: RecurringExpense) => {
    if (!await askConfirm({
      title: en ? 'Skip the next occurrence?' : 'Bỏ qua kỳ tiếp theo?',
      description: en ? `No transaction will be created for ${formatDateOnlyVi(item.nextRunDate)}.` : `Kỳ ngày ${formatDateOnlyVi(item.nextRunDate)} sẽ không tạo giao dịch.`,
      confirmLabel: en ? 'Skip occurrence' : 'Bỏ qua kỳ',
    })) return;
    setBusyId(item.id);
    try {
      const nextRunDate = isSupabaseConfigured
        ? await skipRecurringOccurrence(familyId, item.id)
        : skipLocalRecurringOccurrence(familyId, item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, nextRunDate: nextRunDate || entry.nextRunDate, active: nextRunDate ? (entry.endDate ? nextRunDate <= entry.endDate : entry.active) : false, lastErrorCode: null } : entry));
      notify(en ? 'The next occurrence was skipped.' : 'Đã bỏ qua kỳ tiếp theo.');
    } catch (error) {
      notify(recurringError(error, en, en ? 'Could not skip the occurrence.' : 'Không thể bỏ qua kỳ.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const retryGeneration = async () => {
    if (isSupabaseConfigured && !online) {
      notify(en ? 'Reconnect before retrying.' : 'Hãy kết nối lại trước khi thử lại.', 'error');
      return;
    }
    setBusyId('generation');
    try {
      let count = 0;
      if (isSupabaseConfigured) count = await generateDueRecurringTransactions(familyId);
      else {
        const created = generateLocalDueTransactions(familyId, currentUserId, transactions);
        count = created.length;
        if (created.length) setTransactions((current) => [...current, ...created]);
      }
      await refreshRelatedQueries();
      await loadItems();
      notify(count ? (en ? `Created ${count} planned transaction(s).` : `Đã tạo ${count} giao dịch dự kiến.`) : (en ? 'There are no due occurrences.' : 'Không có kỳ nào đến hạn cần tạo.'));
    } catch (error) {
      notify(recurringError(error, en, en ? 'Could not generate due transactions.' : 'Không thể tự tạo giao dịch đến hạn.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageSkeleton label={en ? 'Loading recurring expenses…' : 'Đang tải khoản chi định kỳ…'} />;

  return <div className="space-y-5">
    <header className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="page-kicker"><Repeat2 size={16} aria-hidden="true" />{en ? 'Automatic planning' : 'Tự động lập kế hoạch'}</p>
        <h2 className="page-title">{en ? 'Recurring expenses' : 'Chi phí định kỳ'}</h2>
        <p className="page-subtitle">{canManage ? (en ? 'The app creates a planned transaction on each due date. Confirm it before it becomes actual.' : 'Ứng dụng tự tạo giao dịch dự kiến khi đến ngày. Hãy xác nhận trước khi giao dịch thành thực tế.') : (en ? 'View the family recurring expenses. Only the owner can make changes.' : 'Xem các khoản chi định kỳ của gia đình. Chỉ chủ gia đình mới có quyền chỉnh sửa.')}</p>
      </div>
      {canManage && <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={busyId === 'generation'} onClick={() => void retryGeneration()}><RefreshCw size={17} aria-hidden="true" />{busyId === 'generation' ? (en ? 'Generating…' : 'Đang tạo…') : (en ? 'Generate due transactions' : 'Tạo giao dịch đến hạn')}</button>
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => openEditor()}><Plus size={17} aria-hidden="true" />{en ? 'Add recurring expense' : 'Thêm khoản định kỳ'}</button>
      </div>}
    </header>

    {pageError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{pageError}<button type="button" className="btn-secondary mt-3 block" onClick={() => void loadItems()}>{en ? 'Try again' : 'Thử lại'}</button></div>}

    {editor && canManage && <section className="card p-4 sm:p-5" aria-labelledby="recurring-editor-title">
      <div className="mb-4 flex items-start justify-between gap-3"><div><p className="page-kicker"><CalendarClock size={16} aria-hidden="true" />{editingId ? (en ? 'Edit template' : 'Chỉnh sửa mẫu') : (en ? 'New template' : 'Mẫu mới')}</p><h3 id="recurring-editor-title" className="text-lg font-extrabold">{editingId ? (en ? 'Update recurring expense' : 'Cập nhật khoản chi định kỳ') : (en ? 'Create recurring expense' : 'Tạo khoản chi định kỳ')}</h3></div><button type="button" className="icon-button" aria-label={en ? 'Close editor' : 'Đóng biểu mẫu'} onClick={closeEditor}><X size={19} /></button></div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void save(event)}>
        <label><span className="label">{en ? 'Template name' : 'Tên mẫu'}</span><input className="field" maxLength={100} required value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder={en ? 'e.g. Electricity bill' : 'Ví dụ: Tiền điện'} /></label>
        <label><span className="label">{en ? 'Description' : 'Nội dung giao dịch'}</span><input className="field" maxLength={200} required value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} placeholder={en ? 'e.g. Electricity' : 'Ví dụ: Tiền điện'} /></label>
        <label><span className="label">{en ? 'Amount (VND)' : 'Số tiền (VND)'}</span><input className="field" inputMode="numeric" required value={displayAmount(editor.amount)} onChange={(event) => setEditor({ ...editor, amount: event.target.value })} placeholder="300.000" /></label>
        <label><span className="label">{en ? 'Frequency' : 'Tần suất'}</span><select className="field" value={editor.frequency} onChange={(event) => setEditor({ ...editor, frequency: event.target.value as RecurringFrequency })}>{recurringFrequencies.map((frequency) => <option key={frequency} value={frequency}>{frequencyLabel(frequency, en)}</option>)}</select></label>
        <label><span className="label">{en ? 'Purpose' : 'Mục đích'}</span><select className="field" required value={editor.purposeId} onChange={(event) => setEditor({ ...editor, purposeId: event.target.value })}><option value="">{en ? 'Select a purpose' : 'Chọn mục đích'}</option>{purposes.map((item) => <option key={item.id} value={item.id}>{getCatalogDisplayName(item, language)}</option>)}</select></label>
        <label><span className="label">{en ? 'Expense type' : 'Danh mục'}</span><select className="field" required value={editor.expenseTypeId} onChange={(event) => setEditor({ ...editor, expenseTypeId: event.target.value })}><option value="">{en ? 'Select an expense type' : 'Chọn danh mục'}</option>{expenseTypes.map((item) => <option key={item.id} value={item.id}>{getCatalogDisplayName(item, language)}</option>)}</select></label>
        <label><span className="label">{en ? 'Payment method' : 'Phương thức thanh toán'}</span><select className="field" required value={editor.paymentMethodId} onChange={(event) => setEditor({ ...editor, paymentMethodId: event.target.value })}><option value="">{en ? 'Select a payment method' : 'Chọn phương thức thanh toán'}</option>{paymentMethods.map((item) => <option key={item.id} value={item.id}>{getCatalogDisplayName(item, language)}</option>)}</select></label>
        <label><span className="label">{en ? 'Next due date' : 'Ngày chạy tiếp theo'}</span><input className="field" type="date" required value={editor.nextRunDate} onChange={(event) => setEditor({ ...editor, nextRunDate: event.target.value })} /></label>
        <label><span className="label">{en ? 'End date (optional)' : 'Ngày kết thúc (không bắt buộc)'}</span><input className="field" type="date" value={editor.endDate} onChange={(event) => setEditor({ ...editor, endDate: event.target.value })} /></label>
        <label className="md:col-span-2"><span className="label">{en ? 'Note (optional)' : 'Ghi chú (không bắt buộc)'}</span><textarea className="field min-h-20" maxLength={500} value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} /></label>
        {editorError && <p role="alert" className="md:col-span-2 text-sm text-red-600 dark:text-red-300">{editorError}</p>}
        <div className="flex gap-2 md:col-span-2"><button type="button" className="btn-secondary flex-1" onClick={closeEditor}>{en ? 'Cancel' : 'Hủy'}</button><button type="submit" className="btn-primary flex-1" disabled={busyId === (editingId || 'new')}>{busyId === (editingId || 'new') ? (en ? 'Saving…' : 'Đang lưu…') : (en ? 'Save template' : 'Lưu mẫu')}</button></div>
      </form>
    </section>}

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={en ? 'Recurring expense summary' : 'Tóm tắt chi phí định kỳ'}><SummaryCard label={en ? 'Active templates' : 'Mẫu đang hoạt động'} value={activeCount} /><SummaryCard label={en ? 'Due today or earlier' : 'Đã đến hạn'} value={dueCount} /><SummaryCard label={en ? 'All templates' : 'Tổng số mẫu'} value={items.length} /></section>

    {!items.length ? <section className="card"><EmptyState icon={Repeat2} title={en ? 'No recurring expenses yet' : 'Chưa có khoản chi định kỳ'} description={canManage ? (en ? 'Add a template and the app will create planned transactions automatically on due dates.' : 'Thêm một mẫu để ứng dụng tự tạo giao dịch dự kiến khi đến ngày.') : (en ? 'The family owner has not set up any recurring expenses.' : 'Chủ gia đình chưa thiết lập khoản chi định kỳ nào.')} action={canManage ? <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => openEditor()}><Plus size={17} />{en ? 'Add the first template' : 'Thêm mẫu đầu tiên'}</button> : undefined} /></section> : <section className="card overflow-hidden"><div className="flex flex-col gap-2 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"><div><h3 className="text-lg font-extrabold">{en ? 'Recurring templates' : 'Các mẫu định kỳ'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Due templates are generated by the daily background job.' : 'Mẫu đến hạn được job nền hằng ngày tự động tạo giao dịch.'}</p></div><span className="ui-chip">VND · {activeCount} {en ? 'active' : 'đang chạy'}</span></div><div className="divide-y divide-black/10 dark:divide-white/10">{items.map((item) => <RecurringRow key={item.id} item={item} en={en} canManage={canManage} busy={busyId === item.id} purposeName={purposeNames.get(item.template.purposeId) || '—'} expenseTypeName={expenseTypeNames.get(item.template.expenseTypeId) || '—'} paymentMethodName={paymentMethodNames.get(item.template.paymentMethodId) || '—'} onEdit={() => openEditor(item)} onToggle={() => void toggleActive(item)} onSkip={() => void skipNext(item)} />)}</div></section>}
  </div>;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="card p-4"><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></div>;
}

function RecurringRow({ item, en, canManage, busy, purposeName, expenseTypeName, paymentMethodName, onEdit, onToggle, onSkip }: { item: RecurringExpense; en: boolean; canManage: boolean; busy: boolean; purposeName: string; expenseTypeName: string; paymentMethodName: string; onEdit: () => void; onToggle: () => void; onSkip: () => void }) {
  const due = item.active && item.nextRunDate <= todayInVietnam();
  return <article className={`p-4 sm:p-5 ${!item.active ? 'opacity-70' : ''}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-base font-extrabold">{item.name}</h4><span className={`ui-chip ${item.active ? '' : 'opacity-70'}`}>{item.active ? (en ? 'Active' : 'Đang chạy') : (en ? 'Paused' : 'Tạm dừng')}</span>{due && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-[#f1fa8c66] dark:bg-[#f1fa8c1f] dark:text-[#f1fa8c]">{en ? 'Due' : 'Đến hạn'}</span>}</div><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.template.description} · <strong className="text-gray-800 dark:text-gray-100">{formatVnd(item.template.amount)}</strong></p><div className="mt-3 flex flex-wrap gap-1.5 text-xs text-gray-600 dark:text-gray-300"><span className="ui-chip">{frequencyLabel(item.frequency, en)}</span><span className="ui-chip">{purposeName}</span><span className="ui-chip">{expenseTypeName}</span><span className="ui-chip">{paymentMethodName}</span></div><p className="mt-3 flex flex-wrap items-center gap-2 text-sm"><CalendarClock size={16} aria-hidden="true" /><span>{en ? 'Next:' : 'Kỳ tiếp theo:'} <strong>{formatDateOnlyVi(item.nextRunDate)}</strong></span>{item.endDate && <span className="text-gray-500 dark:text-gray-400">· {en ? `Until ${formatDateOnlyVi(item.endDate)}` : `Đến ${formatDateOnlyVi(item.endDate)}`}</span>}</p>{item.lastErrorCode && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">{en ? 'The last automatic generation failed. Review the template and retry.' : 'Lần tự tạo gần nhất bị lỗi. Hãy kiểm tra mẫu và thử lại.'}</p>}</div>
      {canManage && <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end"><button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-sm" disabled={busy} onClick={onEdit}><Pencil size={16} aria-hidden="true" />{en ? 'Edit' : 'Sửa'}</button><button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-sm" disabled={busy || !item.active} onClick={onSkip}><SkipForward size={16} aria-hidden="true" />{en ? 'Skip' : 'Bỏ qua'}</button><button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-sm" disabled={busy} onClick={onToggle}>{item.active ? <PauseCircle size={16} aria-hidden="true" /> : <PlayCircle size={16} aria-hidden="true" />}{item.active ? (en ? 'Pause' : 'Tạm dừng') : (en ? 'Resume' : 'Tiếp tục')}</button></div>}
    </div>
  </article>;
}

import { CalendarDays, ChevronLeft, LoaderCircle, RotateCcw, Save, Settings2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageSkeleton } from '../components/AsyncStates';
import { useFeedback } from '../components/Feedback';
import { MultiSelectField } from '../components/MultiSelectField';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import {
  formatAmountFilterInput,
  createSystemTransactionFilterPreset,
  sanitizeTransactionFilterPreset,
  transactionFilterPresetSchema,
  type TransactionFilterPeriod,
  type TransactionFilterPreset,
} from '../lib/transactionFilters';
import {
  clearTransactionFilterPreference,
  fetchTransactionFilterPreference,
  saveTransactionFilterPreference,
} from '../lib/transactionFilterPreferencesApi';
import { userFacingError } from '../lib/errorRecovery';
import { isSupabaseConfigured } from '../lib/supabase';

const periodLabels = {
  'current-month': { vi: 'Tháng hiện tại', en: 'Current month' },
  'current-year': { vi: 'Năm hiện tại', en: 'Current year' },
  'all-time': { vi: 'Không giới hạn', en: 'All time' },
  custom: { vi: 'Khoảng ngày cố định', en: 'Custom date range' },
} as const;

const sortLabels = {
  'date-desc': { vi: 'Ngày mới nhất', en: 'Newest date' },
  'date-asc': { vi: 'Ngày cũ nhất', en: 'Oldest date' },
  'amount-desc': { vi: 'Số tiền cao nhất', en: 'Highest amount' },
  'amount-asc': { vi: 'Số tiền thấp nhất', en: 'Lowest amount' },
  'description-asc': { vi: 'Nội dung A–Z', en: 'Description A–Z' },
} as const;

const optionNames = (
  ids: string[],
  options: Array<{ id: string; name: string; nameEn?: string }>,
  language: 'vi' | 'en',
) => options
  .filter((option) => ids.includes(option.id))
  .map((option) => language === 'en' ? option.nameEn || option.name : option.name);

const formatPresetDate = (value: string, en: boolean) => {
  if (!value) return '…';
  const [year, month, day] = value.split('-');
  return en ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
};

export function TransactionFilterSettings() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const { notify, askConfirm } = useFeedback();
  const queryClient = useQueryClient();
  const {
    familyId,
    currentUserId,
    purposes,
    expenseTypes,
    paymentMethods,
    online,
  } = useApp();
  const catalogs = useMemo(
    () => ({ purposes, expenseTypes, paymentMethods }),
    [expenseTypes, paymentMethods, purposes],
  );
  const systemDefault = useMemo(
    () => createSystemTransactionFilterPreset(purposes),
    [purposes],
  );
  const preferenceQuery = useQuery({
    queryKey: ['transaction-filter-preference', familyId, currentUserId],
    queryFn: () => fetchTransactionFilterPreference(familyId, currentUserId),
    enabled: Boolean(familyId && currentUserId),
    retry: false,
  });
  const preferenceScope = `${familyId}:${currentUserId}`;
  const [initializedScope, setInitializedScope] = useState('');
  const [draft, setDraft] = useState<TransactionFilterPreset>(() =>
    createSystemTransactionFilterPreset([]),
  );
  const [hasSavedPreference, setHasSavedPreference] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!familyId || !currentUserId || preferenceQuery.isPending || initializedScope === preferenceScope) return;
    const saved = preferenceQuery.data
      ? sanitizeTransactionFilterPreset(preferenceQuery.data, catalogs)
      : null;
    setDraft(saved || systemDefault);
    setHasSavedPreference(Boolean(saved));
    setInitializedScope(preferenceScope);
  }, [catalogs, currentUserId, familyId, initializedScope, preferenceQuery.data, preferenceQuery.isPending, preferenceScope, systemDefault]);

  const periodLabel = draft.period === 'custom' && (draft.dateFrom || draft.dateTo)
    ? `${formatPresetDate(draft.dateFrom, en)} → ${formatPresetDate(draft.dateTo, en)}`
    : periodLabels[draft.period][en ? 'en' : 'vi'];
  const purposeNames = optionNames(draft.purposeIds, purposes, en ? 'en' : 'vi');
  const excludedPurposeNames = optionNames(draft.excludePurposeIds, purposes, en ? 'en' : 'vi');
  const expenseTypeNames = optionNames(draft.expenseTypeIds, expenseTypes, en ? 'en' : 'vi');
  const excludedExpenseTypeNames = optionNames(draft.excludeExpenseTypeIds, expenseTypes, en ? 'en' : 'vi');
  const paymentMethodNames = optionNames(draft.paymentMethodIds, paymentMethods, en ? 'en' : 'vi');
  const excludedPaymentMethodNames = optionNames(draft.excludePaymentMethodIds, paymentMethods, en ? 'en' : 'vi');
  const previewSelection = (label: string, names: string[]) => names.length
    ? `${label}: ${names.length > 1 ? `${names.length} ${en ? 'selected' : 'đã chọn'}` : names[0]}`
    : '';
  const previewItems = [
    draft.transactionType || (en ? 'All types' : 'Tất cả loại'),
    draft.status || (en ? 'All statuses' : 'Tất cả trạng thái'),
    periodLabel,
    previewSelection(en ? 'Purpose' : 'Mục đích', purposeNames),
    previewSelection(en ? 'Exclude purpose' : 'Trừ mục đích', excludedPurposeNames),
    previewSelection(en ? 'Category' : 'Danh mục', expenseTypeNames),
    previewSelection(en ? 'Exclude category' : 'Trừ danh mục', excludedExpenseTypeNames),
    previewSelection(en ? 'Payment' : 'Phương thức', paymentMethodNames),
    previewSelection(en ? 'Exclude payment' : 'Trừ phương thức', excludedPaymentMethodNames),
    draft.amountMin ? `${en ? 'From' : 'Từ'} ${formatAmountFilterInput(draft.amountMin)}` : '',
    draft.amountMax ? `${en ? 'Up to' : 'Đến'} ${formatAmountFilterInput(draft.amountMax)}` : '',
    sortLabels[draft.sort][en ? 'en' : 'vi'],
  ].filter(Boolean);

  const updateField = (field: keyof TransactionFilterPreset, value: unknown) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  const updatePeriod = (period: TransactionFilterPeriod) => {
    setDraft((current) => ({
      ...current,
      period,
      ...(period === 'custom' ? {} : { dateFrom: '', dateTo: '' }),
    }));
    setFormError('');
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!familyId || !currentUserId) {
      setFormError(en ? 'No active family was found.' : 'Không tìm thấy gia đình đang hoạt động.');
      return;
    }
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before saving your default filters.' : 'Hãy kết nối lại trước khi lưu bộ lọc mặc định.');
      return;
    }
    const sanitized = sanitizeTransactionFilterPreset(draft, catalogs);
    const parsed = transactionFilterPresetSchema.safeParse(sanitized);
    if (!parsed.success) {
      setFormError(en ? 'Check the date and amount ranges before saving.' : 'Vui lòng kiểm tra khoảng ngày và khoảng số tiền trước khi lưu.');
      return;
    }
    setSaving(true);
    try {
      await saveTransactionFilterPreference(familyId, currentUserId, parsed.data);
      setDraft(parsed.data);
      setHasSavedPreference(true);
      queryClient.setQueryData(
        ['transaction-filter-preference', familyId, currentUserId],
        parsed.data,
      );
      notify(en ? 'Default transaction filters saved.' : 'Đã lưu bộ lọc giao dịch mặc định.');
    } catch (error) {
      setFormError(userFacingError(error, en ? 'Could not save your default filters.' : 'Không thể lưu bộ lọc mặc định.'));
    } finally {
      setSaving(false);
    }
  };

  const resetToSystemDefault = async () => {
    if (!familyId || !currentUserId) return;
    if (!await askConfirm({
      title: en ? 'Restore system defaults?' : 'Khôi phục mặc định hệ thống?',
      description: en ? 'Your personal transaction-filter preset will be removed. The system default will be used when you open Transactions.' : 'Bộ lọc cá nhân sẽ bị xóa. Màn hình Giao dịch sẽ dùng mặc định hệ thống khi mở lại.',
      confirmLabel: en ? 'Restore defaults' : 'Khôi phục mặc định',
    })) return;
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before restoring defaults.' : 'Hãy kết nối lại trước khi khôi phục mặc định.');
      return;
    }
    setResetting(true);
    setFormError('');
    try {
      await clearTransactionFilterPreference(familyId, currentUserId);
      setDraft(systemDefault);
      setHasSavedPreference(false);
      queryClient.setQueryData(
        ['transaction-filter-preference', familyId, currentUserId],
        null,
      );
      notify(en ? 'System defaults restored.' : 'Đã khôi phục mặc định hệ thống.');
    } catch (error) {
      setFormError(userFacingError(error, en ? 'Could not restore system defaults.' : 'Không thể khôi phục mặc định hệ thống.'));
    } finally {
      setResetting(false);
    }
  };

  if (!familyId) {
    return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/30 dark:text-red-300">{en ? 'No active family was found. Please reload and try again.' : 'Không tìm thấy gia đình đang hoạt động. Vui lòng tải lại rồi thử lại.'}</p>;
  }
  if (preferenceQuery.isPending && initializedScope !== preferenceScope) {
    return <PageSkeleton label={en ? 'Loading filter settings…' : 'Đang tải cài đặt bộ lọc…'} />;
  }

  return (
    <div className="transaction-filter-settings-page flex flex-col gap-5">
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-kicker"><Settings2 size={16} aria-hidden="true" />{en ? 'Personal preferences' : 'Tùy chọn cá nhân'}</p>
          <h2 className="page-title">{en ? 'Default transaction filters' : 'Bộ lọc giao dịch mặc định'}</h2>
          <p className="page-subtitle">{en ? 'Choose what you want to see first when the Transactions screen opens.' : 'Chọn những gì bạn muốn xem đầu tiên khi mở màn hình Giao dịch.'}</p>
        </div>
        <Link to="/giao-dich" className="btn-secondary inline-flex items-center gap-2">
          <ChevronLeft size={17} aria-hidden="true" />
          {en ? 'Back to transactions' : 'Quay lại giao dịch'}
        </Link>
      </div>

      {preferenceQuery.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <span>{userFacingError(preferenceQuery.error, en ? 'Could not load your saved filters. The system defaults are shown.' : 'Không thể tải bộ lọc đã lưu. Màn hình đang hiển thị mặc định hệ thống.')}</span>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void preferenceQuery.refetch()}>{en ? 'Retry' : 'Thử lại'}</button>
        </div>
      )}

      <section className="card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="filter-preference-status-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"><Settings2 size={21} aria-hidden="true" /></span>
            <div>
              <h3 id="filter-preference-status-title" className="font-extrabold">{hasSavedPreference ? (en ? 'Personal default is saved' : 'Đang có bộ lọc cá nhân') : (en ? 'Using system defaults' : 'Đang dùng mặc định hệ thống')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'This setting belongs to your account in the active family.' : 'Cài đặt này thuộc tài khoản của bạn trong gia đình hiện tại.'}</p>
            </div>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => updateField('enabled', event.target.checked)}
              className="size-5 accent-emerald-700"
            />
            <span>{en ? 'Use this preset when opening Transactions' : 'Dùng bộ lọc này khi mở Giao dịch'}</span>
          </label>
        </div>
        <p className={`rounded-xl px-3 py-2 text-sm ${draft.enabled ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`} role="status">
          {draft.enabled ? (en ? 'Enabled: the saved preset will be applied unless a link provides explicit filters.' : 'Đang bật: bộ lọc đã lưu sẽ được áp dụng nếu đường dẫn không truyền bộ lọc riêng.') : (en ? 'Disabled: Transactions will use the system defaults.' : 'Đang tắt: Giao dịch sẽ dùng mặc định hệ thống.')}
        </p>
      </section>

      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5" aria-busy={saving || resetting}>
        <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="filter-preference-main-title">
          <div>
            <h3 id="filter-preference-main-title" className="text-lg font-extrabold">{en ? 'Main filters' : 'Bộ lọc chính'}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'These filters define the first view of your ledger.' : 'Các bộ lọc này quyết định danh sách đầu tiên bạn nhìn thấy.'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&_.field]:text-sm [&_.label]:mb-1 [&_.label]:leading-tight">
            <label>
              <span className="label">{en ? 'Transaction type' : 'Loại giao dịch'}</span>
              <select className="field" value={draft.transactionType} onChange={(event) => updateField('transactionType', event.target.value)}>
                <option value="">{en ? 'All types' : 'Tất cả loại'}</option>
                <option value="Chi tiêu">{en ? 'Money out' : 'Chi tiêu'}</option>
                <option value="Thu nhập">{en ? 'Money in' : 'Thu nhập'}</option>
              </select>
            </label>
            <label>
              <span className="label">{en ? 'Status' : 'Trạng thái'}</span>
              <select className="field" value={draft.status} onChange={(event) => updateField('status', event.target.value)}>
                <option value="">{en ? 'All statuses' : 'Tất cả trạng thái'}</option>
                <option value="Thực tế">{en ? 'Actual' : 'Thực tế'}</option>
                <option value="Dự kiến">{en ? 'Planned' : 'Dự kiến'}</option>
              </select>
            </label>
            <label>
              <span className="label">{en ? 'Period' : 'Khoảng thời gian'}</span>
              <select className="field" value={draft.period} onChange={(event) => updatePeriod(event.target.value as TransactionFilterPeriod)}>
                {Object.entries(periodLabels).map(([value, labels]) => <option key={value} value={value}>{labels[en ? 'en' : 'vi']}</option>)}
              </select>
            </label>
            <label>
              <span className="label">{en ? 'Sort' : 'Sắp xếp'}</span>
              <select className="field" value={draft.sort} onChange={(event) => updateField('sort', event.target.value)}>
                {Object.entries(sortLabels).map(([value, labels]) => <option key={value} value={value}>{labels[en ? 'en' : 'vi']}</option>)}
              </select>
            </label>
          </div>
          {draft.period === 'custom' && (
            <div className="grid gap-3 border-t border-black/10 pt-4 sm:grid-cols-2 dark:border-white/10">
              <label>
                <span className="label">{en ? 'From date' : 'Từ ngày'}</span>
                <input className="field" type="date" value={draft.dateFrom} max={draft.dateTo || undefined} onChange={(event) => updateField('dateFrom', event.target.value)} />
              </label>
              <label>
                <span className="label">{en ? 'To date' : 'Đến ngày'}</span>
                <input className="field" type="date" value={draft.dateTo} min={draft.dateFrom || undefined} onChange={(event) => updateField('dateTo', event.target.value)} />
              </label>
            </div>
          )}
        </section>

        <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="filter-preference-catalog-title">
          <div>
            <h3 id="filter-preference-catalog-title" className="text-lg font-extrabold">{en ? 'Catalog filters' : 'Lọc theo danh mục'}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Leave a field empty to include every option.' : 'Để trống nếu muốn giữ lại tất cả lựa chọn.'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&_.field]:py-2 [&_.field]:text-sm [&_.label]:mb-1 [&_.label]:leading-tight">
            <MultiSelectField id="default-purpose-filter" label={en ? 'Purpose' : 'Mục đích'} values={draft.purposeIds} options={purposes} onChange={(values) => updateField('purposeIds', values)} language={language} placeholder={en ? 'All purposes' : 'Tất cả mục đích'} />
            <MultiSelectField id="default-expense-type-filter" label={en ? 'Category' : 'Danh mục'} values={draft.expenseTypeIds} options={expenseTypes} onChange={(values) => updateField('expenseTypeIds', values)} language={language} placeholder={en ? 'All categories' : 'Tất cả danh mục'} />
            <MultiSelectField id="default-payment-method-filter" label={en ? 'Payment method' : 'Phương thức thanh toán'} values={draft.paymentMethodIds} options={paymentMethods} onChange={(values) => updateField('paymentMethodIds', values)} language={language} placeholder={en ? 'All payment methods' : 'Tất cả phương thức'} />
            <MultiSelectField id="default-exclude-purpose-filter" label={en ? 'Exclude purpose' : 'Không gồm mục đích'} values={draft.excludePurposeIds} options={purposes} onChange={(values) => updateField('excludePurposeIds', values)} language={language} placeholder={en ? 'No excluded purposes' : 'Không loại trừ mục đích'} />
            <MultiSelectField id="default-exclude-expense-type-filter" label={en ? 'Exclude category' : 'Không gồm danh mục'} values={draft.excludeExpenseTypeIds} options={expenseTypes} onChange={(values) => updateField('excludeExpenseTypeIds', values)} language={language} placeholder={en ? 'No excluded categories' : 'Không loại trừ danh mục'} />
            <MultiSelectField id="default-exclude-payment-method-filter" label={en ? 'Exclude payment method' : 'Không gồm phương thức'} values={draft.excludePaymentMethodIds} options={paymentMethods} onChange={values => updateField('excludePaymentMethodIds', values)} language={language} placeholder={en ? 'No excluded methods' : 'Không loại trừ phương thức'} />
          </div>
        </section>

        <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="filter-preference-amount-title">
          <div>
            <h3 id="filter-preference-amount-title" className="text-lg font-extrabold">{en ? 'Amount range' : 'Khoảng số tiền'}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Amounts are stored as positive VND values.' : 'Số tiền được lưu dưới dạng số VND dương.'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">{en ? 'Minimum amount' : 'Từ số tiền'}</span>
              <input className="field !text-base" type="text" inputMode="numeric" value={formatAmountFilterInput(draft.amountMin)} onChange={(event) => updateField('amountMin', event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))} />
            </label>
            <label>
              <span className="label">{en ? 'Maximum amount' : 'Đến số tiền'}</span>
              <input className="field !text-base" type="text" inputMode="numeric" value={formatAmountFilterInput(draft.amountMax)} onChange={(event) => updateField('amountMax', event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20" aria-labelledby="filter-preference-preview-title">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" size={20} aria-hidden="true" />
            <div className="min-w-0">
              <h3 id="filter-preference-preview-title" className="font-extrabold">{en ? 'Preview when Transactions opens' : 'Xem trước khi mở Giao dịch'}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {previewItems.map((item, index) => <span key={`${item}-${index}`} className="ui-chip max-w-full break-words">{item}</span>)}
              </div>
              <p className="mt-3 text-xs text-emerald-900/75 dark:text-emerald-100/75">{en ? 'Explicit filters in Dashboard links or shared URLs take precedence over this preset.' : 'Bộ lọc truyền từ Dashboard hoặc đường dẫn chia sẻ sẽ được ưu tiên hơn cài đặt này.'}</p>
            </div>
          </div>
        </section>

        {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{formError}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" className="btn-secondary inline-flex items-center justify-center gap-2" disabled={saving || resetting} onClick={() => void resetToSystemDefault()}>
            {resetting ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={17} aria-hidden="true" />}
            {resetting ? (en ? 'Restoring…' : 'Đang khôi phục…') : (en ? 'Restore system defaults' : 'Khôi phục mặc định hệ thống')}
          </button>
          <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2" disabled={saving || resetting}>
            {saving ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
            {saving ? (en ? 'Saving…' : 'Đang lưu…') : (en ? 'Save default filters' : 'Lưu bộ lọc mặc định')}
          </button>
        </div>
      </form>
    </div>
  );
}

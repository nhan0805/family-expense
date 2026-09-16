import { Coins, Landmark, LockKeyhole, ReceiptText, RotateCcw, Save, Settings2, TrendingUp, WalletCards } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ComponentType, type FormEvent } from 'react';
import { PageSkeleton } from '../components/AsyncStates';
import { useFeedback } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import {
  automaticTransactionDefaultSchema,
  automaticTransactionDefaultsSchema,
  automaticTransactionLabels,
  createSystemAutomaticTransactionDefaults,
  sanitizeAutomaticTransactionDefaults,
  type AutomaticTransactionDefault,
  type AutomaticTransactionKey,
} from '../lib/automaticTransactionDefaults';
import {
  fetchAutomaticTransactionDefaults,
  saveAutomaticTransactionDefaults,
} from '../lib/automaticTransactionDefaultsApi';
import { userFacingError } from '../lib/errorRecovery';
import { getCatalogDisplayName, type CatalogItem } from '../lib/domain';
import { isSupabaseConfigured } from '../lib/supabase';

const groups: Array<{ titleVi: string; titleEn: string; icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>; keys: AutomaticTransactionKey[] }> = [
  {
    titleVi: 'Sổ tiết kiệm',
    titleEn: 'Savings books',
    icon: Landmark,
    keys: ['savings_opening', 'savings_interest', 'savings_withdrawal', 'savings_fee', 'savings_settlement'],
  },
  {
    titleVi: 'Vàng',
    titleEn: 'Gold',
    icon: Coins,
    keys: ['gold_purchase', 'gold_sale'],
  },
];

type CatalogSelectProps = {
  id: string;
  label: string;
  value: string;
  options: CatalogItem[];
  language: 'vi' | 'en';
  disabled?: boolean;
  onChange: (value: string) => void;
};

function CatalogSelect({ id, label, value, options, language, disabled = false, onChange }: CatalogSelectProps) {
  return (
    <label>
      <span className="label">{label}</span>
      <select id={id} className="field text-sm" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{language === 'en' ? 'Select an option' : 'Chọn một mục'}</option>
        {options.map((item) => <option key={item.id} value={item.id}>{getCatalogDisplayName(item, language)}</option>)}
      </select>
    </label>
  );
}

export function AutomaticTransactionSettings() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const { notify, askConfirm } = useFeedback();
  const queryClient = useQueryClient();
  const {
    familyId,
    currentUserRole,
    purposes,
    expenseTypes,
    paymentMethods,
    online,
  } = useApp();
  const catalogs = useMemo(() => ({ purposes, expenseTypes, paymentMethods }), [expenseTypes, paymentMethods, purposes]);
  const systemDefaults = useMemo(() => createSystemAutomaticTransactionDefaults(catalogs), [catalogs]);
  const canEdit = currentUserRole === 'owner';
  const defaultsQuery = useQuery({
    queryKey: ['automatic-transaction-defaults', familyId],
    queryFn: () => fetchAutomaticTransactionDefaults(familyId),
    enabled: Boolean(familyId),
    retry: false,
  });
  const scope = familyId;
  const [initializedScope, setInitializedScope] = useState('');
  const [draft, setDraft] = useState<AutomaticTransactionDefault[]>(systemDefaults);
  const [hasSavedDefaults, setHasSavedDefaults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!familyId || defaultsQuery.isPending || initializedScope === scope) return;
    const saved = defaultsQuery.data?.length
      ? sanitizeAutomaticTransactionDefaults(defaultsQuery.data, catalogs)
      : null;
    setDraft(saved || systemDefaults);
    setHasSavedDefaults(Boolean(saved));
    setInitializedScope(scope);
  }, [catalogs, defaultsQuery.data, defaultsQuery.isPending, familyId, initializedScope, scope, systemDefaults]);

  const updateDefault = (automationKey: AutomaticTransactionKey, field: keyof Omit<AutomaticTransactionDefault, 'automationKey'>, value: string) => {
    setDraft((current) => current.map((item) => item.automationKey === automationKey ? { ...item, [field]: value } : item));
    setFormError('');
  };

  const persist = async (nextDefaults: AutomaticTransactionDefault[], isReset = false) => {
    if (!familyId || !canEdit) return;
    setFormError('');
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before saving automatic transaction settings.' : 'Hãy kết nối lại trước khi lưu cấu hình giao dịch tự động.');
      return;
    }
    const parsed = automaticTransactionDefaultsSchema.safeParse(nextDefaults);
    if (!parsed.success || parsed.data.some((item) => !automaticTransactionDefaultSchema.safeParse(item).success || !item.purposeId || !item.expenseTypeId || !item.paymentMethodId)) {
      setFormError(en ? 'Choose a purpose, category and payment method for every automatic transaction.' : 'Vui lòng chọn đủ mục đích, danh mục và phương thức thanh toán cho từng giao dịch tự động.');
      return;
    }
    setSaving(!isReset);
    setResetting(isReset);
    try {
      const saved = await saveAutomaticTransactionDefaults(familyId, parsed.data);
      const normalized = sanitizeAutomaticTransactionDefaults(saved, catalogs);
      setDraft(normalized);
      setHasSavedDefaults(true);
      queryClient.setQueryData(['automatic-transaction-defaults', familyId], normalized);
      notify(isReset
        ? (en ? 'System automatic transaction defaults restored.' : 'Đã khôi phục cấu hình giao dịch tự động mặc định.')
        : (en ? 'Automatic transaction settings saved.' : 'Đã lưu cấu hình giao dịch tự động.'));
    } catch (error) {
      setFormError(userFacingError(error, en ? 'Could not save automatic transaction settings.' : 'Không thể lưu cấu hình giao dịch tự động.'));
    } finally {
      setSaving(false);
      setResetting(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await persist(draft);
  };

  const reset = async () => {
    if (!canEdit || !await askConfirm({
      title: en ? 'Restore automatic transaction defaults?' : 'Khôi phục cấu hình giao dịch tự động?',
      description: en ? 'Your family choices will be replaced by the system mapping for savings and gold transactions.' : 'Các lựa chọn của gia đình sẽ được thay bằng cấu hình hệ thống cho giao dịch sổ tiết kiệm và vàng.',
      confirmLabel: en ? 'Restore defaults' : 'Khôi phục mặc định',
    })) return;
    await persist(systemDefaults, true);
  };

  if (!familyId) {
    return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/30 dark:text-red-300">{en ? 'No active family was found. Please reload and try again.' : 'Không tìm thấy gia đình đang hoạt động. Vui lòng tải lại rồi thử lại.'}</p>;
  }
  if (defaultsQuery.isPending && initializedScope !== scope) {
    return <PageSkeleton label={en ? 'Loading automatic transaction settings…' : 'Đang tải cấu hình giao dịch tự động…'} />;
  }

  return (
    <section className="automatic-transaction-settings card flex flex-col gap-5 p-4 sm:p-5" aria-labelledby="automatic-transaction-settings-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="page-kicker"><Settings2 size={16} aria-hidden="true" />{en ? 'Family automation' : 'Tự động hóa gia đình'}</p>
          <h2 id="automatic-transaction-settings-title" className="page-title">{en ? 'Automatic transaction defaults' : 'Mặc định giao dịch tự động'}</h2>
          <p className="page-subtitle">{en ? 'Choose the purpose, category and payment method for new transactions created by savings and gold workflows.' : 'Chọn mục đích, danh mục và phương thức thanh toán cho giao dịch mới được tạo từ sổ tiết kiệm và vàng.'}</p>
        </div>
        <span className={`inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-semibold ${hasSavedDefaults ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
          {hasSavedDefaults ? <TrendingUp size={17} aria-hidden="true" /> : <Settings2 size={17} aria-hidden="true" />}
          {hasSavedDefaults ? (en ? 'Family settings saved' : 'Đã lưu cấu hình gia đình') : (en ? 'Using system defaults' : 'Đang dùng mặc định hệ thống')}
        </span>
      </div>

      {defaultsQuery.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><span>{userFacingError(defaultsQuery.error, en ? 'Could not load saved automatic settings. System defaults are shown.' : 'Không thể tải cấu hình đã lưu. Đang hiển thị mặc định hệ thống.')}</span><button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void defaultsQuery.refetch()}>{en ? 'Retry' : 'Thử lại'}</button></div>}

      {!canEdit && <div className="flex items-start gap-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200" role="status"><LockKeyhole size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{en ? 'Only the family owner can change these shared defaults. You can still see which catalogs will be used.' : 'Chỉ chủ gia đình có thể thay đổi các mặc định dùng chung. Bạn vẫn có thể xem các danh mục sẽ được sử dụng.'}</span></div>}

      <form id="automatic-transaction-defaults-form" className="flex flex-col gap-5" onSubmit={(event) => void save(event)}>
        {groups.map(({ titleVi, titleEn, icon: GroupIcon, keys }) => (
          <fieldset key={titleVi} className="space-y-3 rounded-2xl border border-black/10 p-3 dark:border-white/10 sm:p-4" aria-labelledby={`automatic-group-${keys[0]}`}>
            <legend id={`automatic-group-${keys[0]}`} className="flex items-center gap-2 px-1 text-base font-extrabold"><GroupIcon size={18} aria-hidden={true} />{en ? titleEn : titleVi}</legend>
            {keys.map((automationKey) => {
              const item = draft.find((defaultItem) => defaultItem.automationKey === automationKey) || systemDefaults.find((defaultItem) => defaultItem.automationKey === automationKey)!;
              const labels = automaticTransactionLabels[automationKey];
              return <div key={automationKey} className="rounded-xl bg-black/[.025] p-3 dark:bg-white/[.04]">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]" aria-hidden="true">{automationKey.includes('gold') ? <Coins size={17} /> : automationKey === 'savings_interest' ? <TrendingUp size={17} /> : automationKey === 'savings_fee' ? <ReceiptText size={17} /> : automationKey === 'savings_opening' ? <WalletCards size={17} /> : <Landmark size={17} />}</span>
                  <div className="min-w-0"><h3 className="font-bold">{en ? labels.en : labels.vi}</h3><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{en ? labels.descriptionEn : labels.descriptionVi}</p></div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3 [&_.label]:mb-1 [&_.label]:leading-tight">
                  <CatalogSelect id={`${automationKey}-purpose`} label={en ? 'Purpose' : 'Mục đích'} value={item.purposeId} options={purposes} language={language} disabled={!canEdit || saving || resetting} onChange={(value) => updateDefault(automationKey, 'purposeId', value)} />
                  <CatalogSelect id={`${automationKey}-expense-type`} label={en ? 'Category' : 'Danh mục'} value={item.expenseTypeId} options={expenseTypes} language={language} disabled={!canEdit || saving || resetting} onChange={(value) => updateDefault(automationKey, 'expenseTypeId', value)} />
                  <CatalogSelect id={`${automationKey}-payment-method`} label={en ? 'Payment method' : 'Phương thức thanh toán'} value={item.paymentMethodId} options={paymentMethods} language={language} disabled={!canEdit || saving || resetting} onChange={(value) => updateDefault(automationKey, 'paymentMethodId', value)} />
                </div>
              </div>;
            })}
          </fieldset>
        ))}

        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" role="note">{en ? 'These settings apply only to transactions created after you save. Existing transactions keep their current catalogs.' : 'Cấu hình chỉ áp dụng cho giao dịch được tạo sau khi lưu. Giao dịch hiện có vẫn giữ nguyên danh mục.'}</p>
        {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{formError}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2" disabled={!canEdit || saving || resetting} onClick={() => void reset()}><RotateCcw size={17} aria-hidden="true" />{resetting ? (en ? 'Restoring…' : 'Đang khôi phục…') : (en ? 'Restore system defaults' : 'Khôi phục mặc định hệ thống')}</button>
          <button type="submit" className="btn-primary inline-flex min-h-11 items-center justify-center gap-2" disabled={!canEdit || saving || resetting}><Save size={17} aria-hidden="true" />{saving ? (en ? 'Saving…' : 'Đang lưu…') : (en ? 'Save automatic defaults' : 'Lưu mặc định tự động')}</button>
        </div>
      </form>
    </section>
  );
}

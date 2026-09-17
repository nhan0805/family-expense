import { BookCopy, CheckCircle2, Layers3, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { useFeedback } from '../components/Feedback';

export function SystemCatalogDefaultsSettings() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const { notify, askConfirm } = useFeedback();
  const {
    familyId,
    currentUserRole,
    purposes,
    expenseTypes,
    paymentMethods,
    saveCurrentCatalogsAsSystemDefault,
  } = useApp();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const canEdit = currentUserRole === 'owner';

  const save = async () => {
    if (!familyId || !canEdit || saving) return;
    const confirmed = await askConfirm({
      title: en ? 'Use these catalogs for new families?' : 'Dùng các danh mục này cho gia đình mới?',
      description: en
        ? 'Active purposes, expense categories and payment methods in this family will replace the system template. Existing families and transactions will not change.'
        : 'Mục đích, danh mục và phương thức thanh toán đang hoạt động trong gia đình này sẽ thay thế bộ mặc định hệ thống. Gia đình và giao dịch hiện tại không thay đổi.',
      confirmLabel: en ? 'Set as system defaults' : 'Đặt làm mặc định hệ thống',
    });
    if (!confirmed) return;

    setSaving(true);
    setError('');
    const result = await saveCurrentCatalogsAsSystemDefault();
    setSaving(false);
    if (result) {
      setError(result);
      return;
    }
    setSaved(true);
    notify(en ? 'Catalog defaults for new families have been saved.' : 'Đã lưu danh mục mặc định cho các gia đình mới.');
  };

  if (!familyId) {
    return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/30 dark:text-red-300">{en ? 'No active family was found. Please reload and try again.' : 'Không tìm thấy gia đình đang hoạt động. Vui lòng tải lại rồi thử lại.'}</p>;
  }

  return (
    <section className="system-catalog-defaults-settings card flex flex-col gap-5 p-4 sm:p-5" aria-labelledby="system-catalog-defaults-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="page-kicker"><BookCopy size={16} aria-hidden="true" />{en ? 'Family onboarding' : 'Thiết lập gia đình mới'}</p>
          <h2 id="system-catalog-defaults-title" className="page-title">{en ? 'Catalog defaults for new families' : 'Mặc định danh mục cho gia đình mới'}</h2>
          <p className="page-subtitle">{en ? 'Promote the active catalogs in this family to the template used during new-family setup.' : 'Dùng các danh mục đang hoạt động của gia đình hiện tại làm bộ mẫu khi tạo gia đình mới.'}</p>
        </div>
        <span className={`inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-semibold ${saved ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`} role="status">
          {saved ? <CheckCircle2 size={17} aria-hidden="true" /> : <Layers3 size={17} aria-hidden="true" />}
          {saved ? (en ? 'System template saved' : 'Đã lưu bộ mẫu hệ thống') : (en ? 'Current family catalogs' : 'Danh mục của gia đình hiện tại')}
        </span>
      </div>

      {!canEdit && <div className="flex items-start gap-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200" role="status"><LockKeyhole size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{en ? 'Only the family owner can change the system template. You can still see the current active catalog counts.' : 'Chỉ chủ gia đình mới có thể thay đổi bộ mẫu hệ thống. Bạn vẫn có thể xem số lượng danh mục đang hoạt động.'}</span></div>}

      <div className="grid gap-3 sm:grid-cols-3" aria-label={en ? 'Current active catalog counts' : 'Số lượng danh mục đang hoạt động'}>
        <CatalogCount label={en ? 'Purposes' : 'Mục đích'} count={purposes.length} />
        <CatalogCount label={en ? 'Expense categories' : 'Danh mục'} count={expenseTypes.length} />
        <CatalogCount label={en ? 'Payment methods' : 'Phương thức thanh toán'} count={paymentMethods.length} />
      </div>

      <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="note">
        {en
          ? 'Only active catalog items are copied. This affects families created after saving; it does not rename or delete anything in existing families.'
          : 'Chỉ các mục đang hoạt động được sao chép. Thiết lập này áp dụng cho gia đình tạo sau khi lưu; không đổi tên hoặc xóa dữ liệu ở gia đình hiện tại.'}
      </p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      <button type="button" className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 self-start" disabled={!canEdit || saving} onClick={() => void save()}>
        <BookCopy size={17} aria-hidden="true" />
        {saving ? (en ? 'Saving…' : 'Đang lưu…') : (en ? 'Use current catalogs for new families' : 'Dùng danh mục hiện tại cho gia đình mới')}
      </button>
    </section>
  );
}

function CatalogCount({ label, count }: { label: string; count: number }) {
  return <div className="rounded-xl border border-black/10 bg-black/[.02] p-3 dark:border-white/10 dark:bg-white/[.04]"><span className="block text-sm text-gray-500 dark:text-gray-400">{label}</span><strong className="mt-1 block text-2xl font-extrabold tabular-nums">{count}</strong></div>;
}

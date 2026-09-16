import { Settings2, SlidersHorizontal } from 'lucide-react';
import { useOptionalLanguage } from '../context/LanguageContext';
import { AutomaticTransactionSettings } from './AutomaticTransactionSettings';
import { TransactionFilterSettings } from './TransactionFilterSettings';

export function Settings() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';

  return (
    <div className="settings-page flex flex-col gap-6">
      <header className="page-header">
        <p className="page-kicker"><Settings2 size={16} aria-hidden="true" />{en ? 'Preferences' : 'Tùy chọn'}</p>
        <h2 className="page-title">{en ? 'Settings' : 'Cài đặt'}</h2>
        <p className="page-subtitle">{en ? 'Control your first view and the catalogs used by automatic transactions.' : 'Quản lý màn hình mở đầu và danh mục dùng cho các giao dịch tự động.'}</p>
      </header>

      <section aria-labelledby="settings-filter-section-title" className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"><SlidersHorizontal size={19} aria-hidden="true" /></span>
          <div>
            <h3 id="settings-filter-section-title" className="text-lg font-extrabold">{en ? 'Default transaction filters' : 'Bộ lọc giao dịch mặc định'}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Choose which transactions appear first when you open the ledger.' : 'Chọn các giao dịch hiển thị đầu tiên khi bạn mở sổ giao dịch.'}</p>
          </div>
        </div>
        <TransactionFilterSettings embedded />
      </section>

      <AutomaticTransactionSettings />
    </div>
  );
}

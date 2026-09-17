import { Settings2, SlidersHorizontal } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useOptionalLanguage } from '../context/LanguageContext';
import { AutomaticTransactionSettings } from './AutomaticTransactionSettings';
import { TransactionFilterSettings } from './TransactionFilterSettings';

const settingsTabs = [
  {
    id: 'filters',
    icon: SlidersHorizontal,
    labelVi: 'Bộ lọc mặc định',
    labelEn: 'Default filters',
  },
  {
    id: 'automatic',
    icon: Settings2,
    labelVi: 'Giao dịch tự động',
    labelEn: 'Automatic transactions',
  },
] as const;

type SettingsTab = (typeof settingsTabs)[number]['id'];

export function Settings() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const [activeTab, setActiveTab] = useState<SettingsTab>('filters');
  const tabRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({ filters: null, automatic: null });

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: SettingsTab) => {
    const currentIndex = settingsTabs.findIndex((tab) => tab.id === currentTab);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? settingsTabs.length - 1
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? (currentIndex + 1) % settingsTabs.length
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? (currentIndex - 1 + settingsTabs.length) % settingsTabs.length
            : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = settingsTabs[nextIndex]?.id;
    if (!nextTab) return;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <div className="settings-page flex flex-col gap-6">
      <header className="page-header">
        <p className="page-kicker"><Settings2 size={16} aria-hidden="true" />{en ? 'Preferences' : 'Tùy chọn'}</p>
        <h2 className="page-title">{en ? 'Settings' : 'Cài đặt'}</h2>
        <p className="page-subtitle">{en ? 'Control your first view and the catalogs used by automatic transactions.' : 'Quản lý màn hình mở đầu và danh mục dùng cho các giao dịch tự động.'}</p>
      </header>

      <div className="catalog-tabs settings-tabs" role="tablist" aria-label={en ? 'Settings sections' : 'Nhóm cài đặt'}>
        {settingsTabs.map(({ id, icon: Icon, labelVi, labelEn }) => <button
          key={id}
          ref={(element) => { tabRefs.current[id] = element; }}
          id={`settings-tab-${id}`}
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          aria-controls={`settings-panel-${id}`}
          tabIndex={activeTab === id ? 0 : -1}
          className="catalog-tab inline-flex items-center justify-center gap-2"
          onClick={() => setActiveTab(id)}
          onKeyDown={(event) => handleTabKeyDown(event, id)}
        ><Icon size={17} aria-hidden="true" /><span>{en ? labelEn : labelVi}</span></button>)}
      </div>

      <div className="settings-tab-panels">
        <div id="settings-panel-filters" role="tabpanel" aria-labelledby="settings-tab-filters" hidden={activeTab !== 'filters'} className="settings-tab-panel">
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
        </div>

        <div id="settings-panel-automatic" role="tabpanel" aria-labelledby="settings-tab-automatic" hidden={activeTab !== 'automatic'} className="settings-tab-panel">
          <AutomaticTransactionSettings />
        </div>

      </div>
    </div>
  );
}

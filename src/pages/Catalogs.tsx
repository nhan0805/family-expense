import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useApp, type CatalogKind } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { EmptyState } from '../components/AsyncStates';
import {
  getCatalogIcon,
  getCatalogIconLabel,
  getDefaultCatalogIcon,
  searchCatalogIcons,
} from '../lib/catalogIcons';
import { getCatalogDisplayName, type CatalogItem } from '../lib/domain';

type Editor = { kind: CatalogKind; id?: string } | null;

export function Catalogs() {
  const { language } = useOptionalLanguage();
  const isEnglish = language === 'en';
  const {
    currentUserRole,
    purposes,
    expenseTypes,
    paymentMethods,
    addCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
  } = useApp();
  const canManage = currentUserRole === 'owner';
  const [editor, setEditor] = useState<Editor>(null);
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [icon, setIcon] = useState('tag');
  const [iconQuery, setIconQuery] = useState('');
  const [budgetEnabled, setBudgetEnabled] = useState(true);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<CatalogKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openEditor = (kind: CatalogKind, item?: CatalogItem) => {
    setEditor({ kind, id: item?.id });
    setName(item?.name || '');
    setNameEn(item?.nameEn || '');
    setIcon(item?.icon || getDefaultCatalogIcon(item?.name || ''));
    setIconQuery('');
    setBudgetEnabled(item?.budgetEnabled !== false);
    setError('');
    setErrorKind(null);
  };
  const closeEditor = () => {
    setEditor(null);
    setName('');
    setNameEn('');
    setIcon('tag');
    setIconQuery('');
    setBudgetEnabled(true);
    setError('');
    setErrorKind(null);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError('');
    setErrorKind(editor.kind);
    const result = editor.id
      ? await updateCatalogItem(editor.kind, editor.id, name, nameEn, icon, editor.kind === 'purpose' ? budgetEnabled : undefined)
      : await addCatalogItem(editor.kind, name, nameEn, icon, editor.kind === 'purpose' ? budgetEnabled : undefined);
    setSaving(false);
    if (result) return setError(result);
    closeEditor();
  };
  const remove = async (kind: CatalogKind, item: CatalogItem) => {
    const displayName = getCatalogDisplayName(item, isEnglish ? 'en' : 'vi');
    if (!window.confirm(isEnglish
      ? `Delete category “${displayName}”? Categories used by transactions cannot be deleted.`
      : `Bạn có chắc muốn xóa danh mục “${displayName}”? Danh mục đã có giao dịch sẽ không thể xóa.`)) return;
    setDeletingId(item.id);
    setError('');
    setErrorKind(kind);
    const result = await deleteCatalogItem(kind, item.id);
    setDeletingId(null);
    if (result) setError(result);
    else if (editor?.id === item.id) closeEditor();
  };

  const shared = {
    editor,
    name,
    nameEn,
    icon,
    iconQuery,
    budgetEnabled,
    saving,
    deletingId,
    onOpen: openEditor,
    onClose: closeEditor,
    onNameChange: setName,
    onNameEnChange: setNameEn,
    onIconChange: setIcon,
    onIconQueryChange: setIconQuery,
    onBudgetEnabledChange: setBudgetEnabled,
    onSubmit: submit,
    onDelete: remove,
  };
  return <div className="catalogs-page space-y-5">
    <div className="page-header">
      <p className="page-kicker">{isEnglish ? 'Family setup' : 'Thiết lập gia đình'}</p>
      <h2 className="page-title">{isEnglish ? 'Categories' : 'Danh mục'}</h2>
      <p className="page-subtitle">{canManage
        ? (isEnglish ? 'You can add, rename and delete unused categories.' : 'Bạn có thể thêm, đổi tên và xóa danh mục chưa được sử dụng.')
        : (isEnglish ? 'You can view categories. Only the family owner can edit them.' : 'Bạn có thể xem danh mục. Chỉ chủ gia đình mới có quyền chỉnh sửa.')}</p>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Catalog isEnglish={isEnglish} title={isEnglish ? 'Purpose' : 'Mục đích'} kind="purpose" items={purposes} canManage={canManage} error={errorKind === 'purpose' ? error : ''} {...shared} />
      <Catalog isEnglish={isEnglish} title={isEnglish ? 'Expense type' : 'Danh mục'} kind="expenseType" items={expenseTypes} canManage={canManage} error={errorKind === 'expenseType' ? error : ''} {...shared} />
      <Catalog isEnglish={isEnglish} title={isEnglish ? 'Payment method' : 'Phương thức thanh toán'} kind="paymentMethod" items={paymentMethods} canManage={canManage} error={errorKind === 'paymentMethod' ? error : ''} {...shared} />
    </div>
  </div>;
}

type CatalogProps = {
  isEnglish: boolean;
  title: string;
  kind: CatalogKind;
  items: CatalogItem[];
  canManage: boolean;
  editor: Editor;
  name: string;
  nameEn: string;
  icon: string;
  iconQuery: string;
  budgetEnabled: boolean;
  error: string;
  saving: boolean;
  deletingId: string | null;
  onOpen: (kind: CatalogKind, item?: CatalogItem) => void;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onNameEnChange: (name: string) => void;
  onIconChange: (icon: string) => void;
  onIconQueryChange: (query: string) => void;
  onBudgetEnabledChange: (enabled: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
  onDelete: (kind: CatalogKind, item: CatalogItem) => void;
};

function Catalog({
  isEnglish,
  title,
  kind,
  items,
  canManage,
  editor,
  name,
  nameEn,
  icon,
  iconQuery,
  budgetEnabled,
  error,
  saving,
  deletingId,
  onOpen,
  onClose,
  onNameChange,
  onNameEnChange,
  onIconChange,
  onIconQueryChange,
  onBudgetEnabledChange,
  onSubmit,
  onDelete,
}: CatalogProps) {
  const isEditingHere = editor?.kind === kind;
  const displayLanguage = isEnglish ? 'en' : 'vi';
  const visibleIcons = searchCatalogIcons(iconQuery);
  const SelectedIcon = getCatalogIcon(icon);
  return <section className="catalog-card card p-4 sm:p-5">
    <div className="catalog-card-header mb-3"><h3 className="font-bold">{title}</h3>{canManage && <button className="catalog-add-button btn-secondary flex items-center gap-1 text-sm" onClick={() => onOpen(kind)}><Plus size={16} />{isEnglish ? 'Add' : 'Thêm'}</button>}</div>
    {isEditingHere && <form className="catalog-editor mb-3 space-y-2" onSubmit={onSubmit}>
      <div className="flex items-center justify-between"><label className="label mb-0" htmlFor={`catalog-${kind}`}>{editor?.id ? (isEnglish ? `Vietnamese ${title.toLocaleLowerCase('en-US')} name` : `Đổi tên ${title.toLocaleLowerCase('vi-VN')}`) : (isEnglish ? `Vietnamese ${title.toLocaleLowerCase('en-US')} name` : `Tên ${title.toLocaleLowerCase('vi-VN')}`)}</label><button type="button" className="rounded-lg p-1" aria-label={isEnglish ? 'Close' : 'Đóng'} onClick={onClose}><X size={17} /></button></div>
      <input id={`catalog-${kind}`} className="field" autoFocus maxLength={100} required value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={isEnglish ? `Enter Vietnamese ${title.toLocaleLowerCase('en-US')} name` : `Nhập tên ${title.toLocaleLowerCase('vi-VN')}`} />
      <label className="label mb-0" htmlFor={`catalog-${kind}-en`}>{isEnglish ? 'English name (optional)' : 'Tên tiếng Anh (không bắt buộc)'}</label>
      <input id={`catalog-${kind}-en`} className="field" maxLength={100} value={nameEn} onChange={(event) => onNameEnChange(event.target.value)} placeholder={isEnglish ? `Enter English ${title.toLocaleLowerCase('en-US')} name` : 'Nhập tên tiếng Anh để hiển thị khi dùng English'} />
      <div className="space-y-2">
        <span className="label mb-0">{isEnglish ? 'Icon' : 'Biểu tượng'}</span>
        <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-gray-50 p-2 dark:border-white/10 dark:bg-white/[.04]">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#137050] shadow-sm dark:bg-[#44475a] dark:text-[#50fa7b]" aria-label={isEnglish ? `Selected icon: ${getCatalogIconLabel(icon)}` : `Biểu tượng đã chọn: ${getCatalogIconLabel(icon)}`}>
            <SelectedIcon size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{getCatalogIconLabel(icon)}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{isEnglish ? 'Search and select an icon below.' : 'Tìm và chọn biểu tượng bên dưới.'}</span>
          </div>
          <Search size={17} className="shrink-0 text-gray-500" aria-hidden="true" />
        </div>
        <label className="sr-only" htmlFor={`catalog-icon-search-${kind}`}>{isEnglish ? `Search icon for ${title}` : `Tìm biểu tượng cho ${title}`}</label>
        <input id={`catalog-icon-search-${kind}`} className="field" value={iconQuery} onChange={(event) => onIconQueryChange(event.target.value)} placeholder={isEnglish ? 'Search by icon name or keyword' : 'Tìm theo tên icon hoặc từ khóa'} />
        {visibleIcons.length ? <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-black/10 p-2 dark:border-white/10 sm:grid-cols-6" role="listbox" aria-label={isEnglish ? `Icons for ${title}` : `Biểu tượng cho ${title}`}>
          {visibleIcons.map(({ key, label, Icon }) => <button key={key} type="button" role="option" aria-selected={icon === key} title={label} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-[11px] transition ${icon === key ? 'border-[#137050] bg-[#e5f2eb] text-[#137050] dark:border-[#50fa7b] dark:bg-[#50fa7b1f] dark:text-[#50fa7b]' : 'border-transparent text-gray-600 hover:border-black/10 hover:bg-black/[.03] dark:text-gray-300 dark:hover:border-white/10 dark:hover:bg-white/5'}`} onClick={() => onIconChange(key)}><span className="relative"><Icon size={20} aria-hidden="true" />{icon === key && <Check size={11} className="absolute -right-2 -top-1 rounded-full bg-[#137050] text-white dark:bg-[#50fa7b] dark:text-[#282a36]" aria-hidden="true" />}</span><span className="max-w-full truncate">{label}</span></button>)}
        </div> : <p className="rounded-xl border border-dashed border-black/10 p-3 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">{isEnglish ? 'No matching icon.' : 'Không tìm thấy biểu tượng phù hợp.'}</p>}
      </div>
      {kind === 'purpose' && <label className="flex items-start gap-2 rounded-xl border border-black/10 bg-black/[.02] p-3 text-sm dark:border-white/10 dark:bg-white/[.03]">
        <input className="mt-0.5 size-4 accent-[#137050] dark:accent-[#50fa7b]" type="checkbox" aria-label={isEnglish ? 'Track in budgets' : 'Theo dõi trong ngân sách'} checked={budgetEnabled} onChange={(event) => onBudgetEnabledChange(event.target.checked)} />
        <span><span className="block font-semibold">{isEnglish ? 'Track in budgets' : 'Theo dõi trong ngân sách'}</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{isEnglish ? 'Include this purpose in budget totals, alerts and monthly summaries.' : 'Tính mục đích này vào tổng, cảnh báo và tổng hợp ngân sách theo tháng.'}</span></span>
      </label>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={saving}>{saving ? (isEnglish ? 'Saving…' : 'Đang lưu…') : editor?.id ? (isEnglish ? 'Save new name' : 'Lưu tên mới') : (isEnglish ? 'Save category' : 'Lưu danh mục')}</button>
    </form>}
    {!isEditingHere && error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    {items.length ? <div className="catalog-list divide-y divide-black/10 dark:divide-white/10">{items.map((item) => {
      const displayName = getCatalogDisplayName(item, displayLanguage);
      const ItemIcon = getCatalogIcon(item.icon);
      return <div key={item.id} className="catalog-item flex items-center justify-between gap-2"><div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e5f2eb] text-[#137050] dark:bg-[#50fa7b1f] dark:text-[#50fa7b]" title={getCatalogIconLabel(item.icon)}><ItemIcon size={17} aria-hidden="true" /></span><div className="min-w-0 flex-1"><span className="block truncate" title={displayName}>{displayName}</span>{kind === 'purpose' && item.budgetEnabled === false && <span className="ui-chip mt-1 w-fit whitespace-nowrap text-[11px]">{isEnglish ? 'Budget hidden' : 'Ẩn ngân sách'}</span>}</div></div>{canManage && <div className="flex shrink-0 items-center gap-1"><button type="button" className="catalog-action icon-button text-[#137050] hover:bg-[#e5f2eb] focus-visible:outline focus-visible:outline-2 dark:text-emerald-300 dark:hover:bg-white/5" aria-label={`${isEnglish ? 'Edit' : 'Sửa'} ${displayName}`} title={isEnglish ? 'Edit' : 'Sửa'} onClick={() => onOpen(kind, item)}><Pencil size={17} /></button><button type="button" className="catalog-action icon-button text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30" aria-label={`${isEnglish ? 'Delete' : 'Xóa'} ${displayName}`} title={isEnglish ? 'Delete' : 'Xóa'} disabled={deletingId === item.id} onClick={() => onDelete(kind, item)}><Trash2 size={17} /></button></div>}</div>;
    })}</div> : <EmptyState title={isEnglish ? `No ${title.toLocaleLowerCase('en-US')} yet` : `Chưa có ${title.toLocaleLowerCase('vi-VN')}`} description={canManage ? (isEnglish ? 'Select Add to create the first category.' : 'Bấm Thêm để tạo danh mục đầu tiên.') : (isEnglish ? 'The family owner has not set up this category.' : 'Chủ gia đình chưa thiết lập danh mục này.')} />}
  </section>;
}

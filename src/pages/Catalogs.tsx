import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useApp, type CatalogKind } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { EmptyState } from '../components/AsyncStates';

type Editor = { kind: CatalogKind; id?: string } | null;

export function Catalogs() {
  const { language } = useOptionalLanguage();
  const isEnglish = language === 'en';
  const { currentUserRole, purposes, expenseTypes, paymentMethods, addCatalogItem, updateCatalogItem, deleteCatalogItem } = useApp();
  const canManage = currentUserRole === 'owner';
  const [editor, setEditor] = useState<Editor>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<CatalogKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openEditor = (kind: CatalogKind, item?: { id: string; name: string }) => { setEditor({ kind, id: item?.id }); setName(item?.name || ''); setError(''); setErrorKind(null); };
  const closeEditor = () => { setEditor(null); setName(''); setError(''); setErrorKind(null); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setSaving(true); setError(''); setErrorKind(editor.kind);
    const result = editor.id ? await updateCatalogItem(editor.kind, editor.id, name) : await addCatalogItem(editor.kind, name);
    setSaving(false);
    if (result) return setError(result);
    closeEditor();
  };
  const remove = async (kind: CatalogKind, item: { id: string; name: string }) => {
    if (!window.confirm(isEnglish ? `Delete category “${item.name}”? Categories used by transactions cannot be deleted.` : `Bạn có chắc muốn xóa danh mục “${item.name}”? Danh mục đã có giao dịch sẽ không thể xóa.`)) return;
    setDeletingId(item.id); setError(''); setErrorKind(kind);
    const result = await deleteCatalogItem(kind, item.id);
    setDeletingId(null);
    if (result) setError(result); else if (editor?.id === item.id) closeEditor();
  };

  const shared = { editor, name, saving, deletingId, onOpen: openEditor, onClose: closeEditor, onNameChange: setName, onSubmit: submit, onDelete: remove };
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-extrabold">{isEnglish ? 'Categories' : 'Danh mục'}</h2><p className="text-sm text-gray-500">{canManage ? (isEnglish ? 'You can add, rename and delete unused categories.' : 'Bạn có thể thêm, đổi tên và xóa danh mục chưa được sử dụng.') : (isEnglish ? 'You can view categories. Only the family owner can edit them.' : 'Bạn có thể xem danh mục. Chỉ chủ gia đình mới có quyền chỉnh sửa.')}</p></div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Catalog isEnglish={isEnglish} title={isEnglish ? 'Purpose' : 'Mục đích'} kind="purpose" items={purposes} canManage={canManage} error={errorKind === 'purpose' ? error : ''} {...shared}/>
      <Catalog isEnglish={isEnglish} title={isEnglish ? 'Expense type' : 'Danh mục'} kind="expenseType" items={expenseTypes} canManage={canManage} error={errorKind === 'expenseType' ? error : ''} {...shared}/>
      <Catalog isEnglish={isEnglish} title={isEnglish ? 'Payment method' : 'Phương thức thanh toán'} kind="paymentMethod" items={paymentMethods} canManage={canManage} error={errorKind === 'paymentMethod' ? error : ''} {...shared}/>
    </div>
  </div>;
}

type CatalogProps = {
  isEnglish: boolean;
  title: string; kind: CatalogKind; items: { id: string; name: string }[]; canManage: boolean; editor: Editor; name: string; error: string; saving: boolean; deletingId: string | null;
  onOpen: (kind: CatalogKind, item?: { id: string; name: string }) => void; onClose: () => void; onNameChange: (name: string) => void;
  onSubmit: (event: React.FormEvent) => void; onDelete: (kind: CatalogKind, item: { id: string; name: string }) => void;
};

function Catalog({ isEnglish, title, kind, items, canManage, editor, name, error, saving, deletingId, onOpen, onClose, onNameChange, onSubmit, onDelete }: CatalogProps) {
  const isEditingHere = editor?.kind === kind;
  return <section className="card p-4">
    <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{title}</h3>{canManage && <button className="btn-secondary flex items-center gap-1 text-sm" onClick={() => onOpen(kind)}><Plus size={16} />{isEnglish ? 'Add' : 'Thêm'}</button>}</div>
    {isEditingHere && <form className="mb-3 space-y-2 rounded-xl bg-[#eef4ef] p-3 dark:bg-white/5" onSubmit={onSubmit}>
      <div className="flex items-center justify-between"><label className="label mb-0" htmlFor={`catalog-${kind}`}>{editor?.id ? (isEnglish ? `Rename ${title.toLocaleLowerCase('en-US')}` : `Đổi tên ${title.toLocaleLowerCase('vi-VN')}`) : (isEnglish ? `${title} name` : `Tên ${title.toLocaleLowerCase('vi-VN')}`)}</label><button type="button" className="rounded-lg p-1" aria-label={isEnglish ? 'Close' : 'Đóng'} onClick={onClose}><X size={17}/></button></div>
      <input id={`catalog-${kind}`} className="field bg-white dark:bg-[#17251f]" autoFocus maxLength={100} required value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={isEnglish ? `Enter ${title.toLocaleLowerCase('en-US')} name` : `Nhập tên ${title.toLocaleLowerCase('vi-VN')}`}/>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={saving}>{saving ? (isEnglish ? 'Saving…' : 'Đang lưu…') : editor?.id ? (isEnglish ? 'Save new name' : 'Lưu tên mới') : (isEnglish ? 'Save category' : 'Lưu danh mục')}</button>
    </form>}
    {!isEditingHere && error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    {items.length ? <div className="divide-y divide-black/10 dark:divide-white/10">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 flex-1 truncate" title={item.name}>{item.name}</span>{canManage && <div className="flex shrink-0 items-center gap-1"><button type="button" className="rounded-lg p-2 text-[#137050] hover:bg-[#e5f2eb] focus-visible:outline focus-visible:outline-2 dark:text-emerald-300 dark:hover:bg-white/5" aria-label={`${isEnglish ? 'Edit' : 'Sửa'} ${item.name}`} title={isEnglish ? 'Edit' : 'Sửa'} onClick={() => onOpen(kind, item)}><Pencil size={17}/></button><button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30" aria-label={`${isEnglish ? 'Delete' : 'Xóa'} ${item.name}`} title={isEnglish ? 'Delete' : 'Xóa'} disabled={deletingId === item.id} onClick={() => onDelete(kind, item)}><Trash2 size={17}/></button></div>}</div>)}</div> : <EmptyState title={isEnglish ? `No ${title.toLocaleLowerCase('en-US')} yet` : `Chưa có ${title.toLocaleLowerCase('vi-VN')}`} description={canManage ? (isEnglish ? 'Select Add to create the first category.' : 'Bấm Thêm để tạo danh mục đầu tiên.') : (isEnglish ? 'The family owner has not set up this category.' : 'Chủ gia đình chưa thiết lập danh mục này.')}/>}
  </section>;
}

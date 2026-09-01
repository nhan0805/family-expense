import {
  Copy,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  canDeleteTransaction,
  formatVnd,
  transactionTypeLabel,
  type Transaction,
} from '../lib/domain';

type TransactionRowProps = {
  transaction: Transaction;
  purposeName: string;
  expenseTypeName: string;
  paymentMethodName: string;
  showTrash: boolean;
  selectMode: boolean;
  selected: boolean;
  openMenu: boolean;
  deleting: boolean;
  copying: boolean;
  currentUserRole: 'owner' | 'member' | null;
  currentUserId: string;
  onToggleSelected: (id: string) => void;
  onSetSelected: (ids: Set<string>) => void;
  onToggleMenu: (id: string) => void;
  onRestore: () => void;
  onPermanentlyDelete: () => void;
  onCopy: (transaction: Transaction) => void;
  onRemove: (id: string) => void;
};

export function TransactionRow({
  transaction,
  purposeName,
  expenseTypeName,
  paymentMethodName,
  showTrash,
  selectMode,
  selected,
  openMenu,
  deleting,
  copying,
  currentUserRole,
  currentUserId,
  onToggleSelected,
  onSetSelected,
  onToggleMenu,
  onRestore,
  onPermanentlyDelete,
  onCopy,
  onRemove,
}: TransactionRowProps) {
  const tone = transaction.transactionType === 'Thu nhập'
    ? { rowClass: 'bg-gradient-to-r from-emerald-100/90 via-emerald-50/55 to-transparent dark:from-emerald-950/65 dark:via-emerald-950/25 dark:to-transparent', amountClass: 'text-emerald-700 dark:text-emerald-300', badgeClass: 'border border-emerald-300 bg-emerald-200 text-emerald-950 shadow-sm dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100' }
    : transaction.transactionType === 'Hoàn tiền'
      ? { rowClass: 'bg-gradient-to-r from-sky-100/90 via-sky-50/55 to-transparent dark:from-sky-950/65 dark:via-sky-950/25 dark:to-transparent', amountClass: 'text-sky-700 dark:text-sky-300', badgeClass: 'border border-sky-300 bg-sky-200 text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-900 dark:text-sky-100' }
      : transaction.transactionType === 'Tạm ứng'
        ? { rowClass: 'bg-gradient-to-r from-amber-100/90 via-amber-50/55 to-transparent dark:from-amber-950/65 dark:via-amber-950/25 dark:to-transparent', amountClass: 'text-amber-700 dark:text-amber-300', badgeClass: 'border border-amber-300 bg-amber-200 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100' }
        : { rowClass: 'bg-gradient-to-r from-rose-100/90 via-rose-50/55 to-transparent dark:from-rose-950/65 dark:via-rose-950/25 dark:to-transparent', amountClass: 'text-rose-700 dark:text-rose-300', badgeClass: 'border border-rose-300 bg-rose-200 text-rose-950 shadow-sm dark:border-rose-700 dark:bg-rose-900 dark:text-rose-100' };
  const setOnlySelected = () => onSetSelected(new Set([transaction.id]));
  const date = new Date(`${transaction.transactionDate}T00:00:00`).toLocaleDateString('vi-VN');
  const canDelete = canDeleteTransaction(transaction, currentUserRole, currentUserId);

  return (
    <div>
      <article aria-label={`Giao dịch ${transaction.description}`} className={`transaction-card relative rounded-2xl border border-black/10 p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 md:hidden ${tone.rowClass}`}>
        <div className="flex items-start justify-between gap-3">
          {selectMode && <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#155e46]" aria-label={`Chọn giao dịch ${transaction.description}`} checked={selected} onChange={() => onToggleSelected(transaction.id)} />}
          <div className="min-w-0 flex-1">
            {showTrash ? <span className="block truncate text-base font-bold">{transaction.description}</span> : <Link to={`/giao-dich/${transaction.id}`} className="block truncate text-base font-bold active:opacity-70">{transaction.description}</Link>}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><span>{date}</span><span className={`rounded-full px-2 py-0.5 font-semibold ${tone.badgeClass}`}>{transactionTypeLabel(transaction.transactionType)}</span></div>
          </div>
          <div className="flex shrink-0 items-start gap-1"><strong className={`pt-1 text-base ${tone.amountClass} ${showTrash ? 'line-through opacity-70' : ''}`}>{formatVnd(transaction.amount)}</strong>{showTrash && <><button type="button" className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30" aria-label={`Khôi phục ${transaction.description}`} title="Khôi phục" onClick={() => { setOnlySelected(); onRestore(); }}><RotateCcw size={18}/></button><button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30" aria-label={`Xóa vĩnh viễn ${transaction.description}`} title="Xóa vĩnh viễn" onClick={() => { setOnlySelected(); onPermanentlyDelete(); }}><Trash2 size={18}/></button></>}{!showTrash && <button type="button" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5" aria-label={`Thao tác với ${transaction.description}`} aria-expanded={openMenu} onClick={() => onToggleMenu(transaction.id)}><MoreHorizontal size={19}/></button>}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5"><span className="transaction-card-tag">{purposeName}</span><span className="transaction-card-tag">{expenseTypeName}</span>{paymentMethodName !== '—' && <span className="transaction-card-tag">{paymentMethodName}</span>}</div>
        {openMenu && <div className="absolute right-3 top-12 z-10 min-w-40 overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#203029]"><Link className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5" to={`/giao-dich/${transaction.id}`} onClick={() => onToggleMenu(transaction.id)}><Pencil size={16}/>Sửa</Link><button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5" disabled={copying} onClick={() => { onToggleMenu(transaction.id); onCopy(transaction); }}><Copy size={16}/>Sao chép</button>{canDelete && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30" disabled={deleting} onClick={() => { onToggleMenu(transaction.id); onRemove(transaction.id); }}><Trash2 size={16}/>Xóa</button>}</div>}
      </article>
      <div className={`transaction-table-row hidden gap-1 border-t border-black/5 p-3 transition-colors hover:brightness-[.98] dark:border-white/5 dark:hover:brightness-110 md:grid md:min-w-[980px] md:items-center ${selectMode ? 'md:grid-cols-[32px_80px_minmax(160px,1fr)_130px_120px_145px_110px_70px]' : 'md:grid-cols-[80px_minmax(160px,1fr)_130px_120px_145px_110px_70px]'} ${tone.rowClass}`}>
        {selectMode && <input type="checkbox" className="size-5 accent-[#155e46]" aria-label={`Chọn giao dịch ${transaction.description} trên bảng`} checked={selected} onChange={() => onToggleSelected(transaction.id)} />}
        <span className="text-sm text-gray-500">{date}</span>
        <Link to={`/giao-dich/${transaction.id}`} className="text-sm font-semibold hover:underline">{transaction.description}<span className={`ml-2 inline-flex rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold ${tone.badgeClass}`}>{transactionTypeLabel(transaction.transactionType)}</span><small className="mt-1 block font-normal text-gray-500 md:hidden">{purposeName} · {expenseTypeName} · {paymentMethodName}</small></Link>
        <span className="hidden text-sm md:block">{purposeName}</span><span className="hidden text-sm md:block">{expenseTypeName}</span><span className="hidden text-sm md:block">{paymentMethodName}</span>
        <strong className={`text-sm font-bold ${tone.amountClass}`}>{formatVnd(transaction.amount)}</strong>
        <span className="flex justify-start gap-1">{showTrash && <button type="button" aria-label={`Khôi phục ${transaction.description}`} title="Khôi phục" className="p-2 text-emerald-700" onClick={() => { setOnlySelected(); onRestore(); }}><RotateCcw size={17}/></button>}{showTrash && <button type="button" aria-label={`Xóa vĩnh viễn ${transaction.description}`} title="Xóa vĩnh viễn" className="p-2 text-red-600" onClick={() => { setOnlySelected(); onPermanentlyDelete(); }}><Trash2 size={17}/></button>}<span className={showTrash ? 'hidden' : 'contents'}><button aria-label="Sao chép" className="p-2" disabled={copying} onClick={() => onCopy(transaction)}><Copy size={17}/></button>{canDelete && <button aria-label="Xóa" className="p-2 text-red-600" disabled={deleting} onClick={() => onRemove(transaction.id)}><Trash2 size={17}/></button>}</span></span>
      </div>
    </div>
  );
}

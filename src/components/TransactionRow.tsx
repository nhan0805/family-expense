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
  formatDateOnlyVi,
  formatVnd,
  transactionTypeLabel,
  type Transaction,
} from '../lib/domain';
import { getCatalogIcon } from '../lib/catalogIcons';

type TransactionRowProps = {
  transaction: Transaction;
  purposeName: string;
  purposeIcon?: string;
  expenseTypeName: string;
  expenseTypeIcon?: string;
  paymentMethodName: string;
  paymentMethodIcon?: string;
  recurringLabel?: string;
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
  purposeIcon,
  expenseTypeName,
  expenseTypeIcon,
  paymentMethodName,
  paymentMethodIcon,
  recurringLabel = 'Định kỳ',
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
    ? { rowClass: 'bg-gradient-to-r from-emerald-100/90 via-emerald-50/55 to-transparent dark:from-[#50fa7b1f] dark:via-[#50fa7b08] dark:to-transparent', amountClass: 'text-emerald-700 dark:text-[#50fa7b]', badgeClass: 'border border-emerald-300 bg-emerald-200 text-emerald-950 shadow-sm dark:border-[#50fa7b99] dark:bg-[#50fa7b1f] dark:text-[#50fa7b]' }
        : { rowClass: 'bg-gradient-to-r from-rose-100/90 via-rose-50/55 to-transparent dark:from-[#ff79c61f] dark:via-[#ff79c608] dark:to-transparent', amountClass: 'text-rose-700 dark:text-[#ff79c6]', badgeClass: 'border border-rose-300 bg-rose-200 text-rose-950 shadow-sm dark:border-[#ff79c699] dark:bg-[#ff79c61f] dark:text-[#ff79c6]' };
  const setOnlySelected = () => onSetSelected(new Set([transaction.id]));
  const date = formatDateOnlyVi(transaction.transactionDate);
  const canDelete = canDeleteTransaction(transaction, currentUserRole, currentUserId);

  return (
    <div>
      <article aria-label={`Giao dịch ${transaction.description}`} className={`transaction-card relative rounded-2xl border border-black/10 p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 md:hidden ${tone.rowClass}`}>
        <div className="flex items-start justify-between gap-3">
          {selectMode && <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#155e46]" aria-label={`Chọn giao dịch ${transaction.description}`} checked={selected} onChange={() => onToggleSelected(transaction.id)} />}
          <div className="min-w-0 flex-1">
            {showTrash ? <span className="block truncate text-base font-bold">{transaction.description}</span> : <Link to={`/giao-dich/${transaction.id}`} className="block truncate text-base font-bold active:opacity-70">{transaction.description}</Link>}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><span>{date}</span><span className={`rounded-full px-2 py-0.5 font-semibold ${tone.badgeClass}`}>{transactionTypeLabel(transaction.transactionType)}</span>{transaction.source === 'recurring' && <span className="ui-chip">{recurringLabel}</span>}</div>
          </div>
          <div className="flex shrink-0 items-start gap-1"><strong className={`pt-1 text-base ${tone.amountClass} ${showTrash ? 'line-through opacity-70' : ''}`}>{formatVnd(transaction.amount)}</strong>{showTrash && <><button type="button" className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30" aria-label={`Khôi phục ${transaction.description}`} title="Khôi phục" onClick={() => { setOnlySelected(); onRestore(); }}><RotateCcw size={18}/></button><button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30" aria-label={`Xóa vĩnh viễn ${transaction.description}`} title="Xóa vĩnh viễn" onClick={() => { setOnlySelected(); onPermanentlyDelete(); }}><Trash2 size={18}/></button></>}{!showTrash && <button type="button" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5" aria-label={`Thao tác với ${transaction.description}`} aria-expanded={openMenu} onClick={() => onToggleMenu(transaction.id)}><MoreHorizontal size={19}/></button>}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5"><CatalogTag name={purposeName} icon={purposeIcon} /><CatalogTag name={expenseTypeName} icon={expenseTypeIcon} />{paymentMethodName !== '—' && <CatalogTag name={paymentMethodName} icon={paymentMethodIcon} />}</div>
        {openMenu && <div className="absolute right-3 top-12 z-10 min-w-40 overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#343746]"><Link className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5" to={`/giao-dich/${transaction.id}`} onClick={() => onToggleMenu(transaction.id)}><Pencil size={16}/>Sửa</Link><button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5" disabled={copying} onClick={() => { onToggleMenu(transaction.id); onCopy(transaction); }}><Copy size={16}/>Sao chép</button>{canDelete && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30" disabled={deleting} onClick={() => { onToggleMenu(transaction.id); onRemove(transaction.id); }}><Trash2 size={16}/>Xóa</button>}</div>}
      </article>
      <div className={`transaction-table-row hidden w-full gap-1 border-t border-black/5 p-3 transition-colors hover:brightness-[.98] dark:border-white/5 dark:hover:brightness-110 md:grid md:min-w-[1080px] md:items-center ${selectMode ? 'md:grid-cols-[32px_80px_minmax(180px,1fr)_190px_160px_190px_220px]' : 'md:grid-cols-[80px_minmax(180px,1fr)_190px_160px_190px_220px]'} ${tone.rowClass}`}>
        {selectMode && <input type="checkbox" className="size-5 accent-[#155e46]" aria-label={`Chọn giao dịch ${transaction.description} trên bảng`} checked={selected} onChange={() => onToggleSelected(transaction.id)} />}
        <span className="text-sm text-gray-500">{date}</span>
        <Link to={`/giao-dich/${transaction.id}`} className="min-w-0 truncate text-sm font-semibold hover:underline">{transaction.description}<span className={`ml-2 inline-flex rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold ${tone.badgeClass}`}>{transactionTypeLabel(transaction.transactionType)}</span>{transaction.source === 'recurring' && <span className="ui-chip ml-2 align-middle text-[11px]">{recurringLabel}</span>}<small className="mt-1 block font-normal text-gray-500 md:hidden">{purposeName} · {expenseTypeName} · {paymentMethodName}</small></Link>
        <CatalogValue name={purposeName} icon={purposeIcon} /><CatalogValue name={expenseTypeName} icon={expenseTypeIcon} /><CatalogValue name={paymentMethodName} icon={paymentMethodIcon} />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px] items-center gap-1">
          <strong className={`transaction-row-amount min-w-0 truncate text-sm font-bold ${tone.amountClass}`}>{formatVnd(transaction.amount)}</strong>
          <span className="transaction-row-actions grid w-[72px] shrink-0 grid-cols-2 items-center">{showTrash && <button type="button" aria-label={`Khôi phục ${transaction.description}`} title="Khôi phục" className="grid size-8 place-items-center text-emerald-700" onClick={() => { setOnlySelected(); onRestore(); }}><RotateCcw size={17}/></button>}{showTrash && <button type="button" aria-label={`Xóa vĩnh viễn ${transaction.description}`} title="Xóa vĩnh viễn" className="grid size-8 place-items-center text-red-600" onClick={() => { setOnlySelected(); onPermanentlyDelete(); }}><Trash2 size={17}/></button>}<span className={showTrash ? 'hidden' : 'contents'}><button type="button" aria-label="Sao chép" className="grid size-8 place-items-center" disabled={copying} onClick={() => onCopy(transaction)}><Copy size={17}/></button>{canDelete && <button type="button" aria-label="Xóa" className="grid size-8 place-items-center text-red-600" disabled={deleting} onClick={() => onRemove(transaction.id)}><Trash2 size={17}/></button>}</span></span>
        </div>
      </div>
    </div>
  );
}

function CatalogTag({ name, icon }: { name: string; icon?: string }) {
  const Icon = getCatalogIcon(icon);
  return <span className="transaction-card-tag gap-1.5"><Icon className="catalog-tag-icon shrink-0" size={13} aria-hidden="true" /><span className="min-w-0 truncate">{name}</span></span>;
}

function CatalogValue({ name, icon }: { name: string; icon?: string }) {
  const Icon = getCatalogIcon(icon);
  return <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm" title={name}><Icon className="catalog-value-icon shrink-0" size={15} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{name}</span></span>;
}

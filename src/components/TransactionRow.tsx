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
  type Transaction,
} from '../lib/domain';
import { getCatalogIcon } from '../lib/catalogIcons';
import { memo } from 'react';
import { useOptionalLanguage } from '../context/LanguageContext';
import { Amount } from './ui/Amount';

type TransactionRowProps = {
  transaction: Transaction;
  purposeName: string;
  purposeIcon?: string;
  expenseTypeName: string;
  expenseTypeIcon?: string;
  paymentMethodName: string;
  paymentMethodIcon?: string;
  recurringLabel?: string;
  plannedLabel?: string;
  actualLabel?: string;
  showTrash: boolean;
  selectMode: boolean;
  selected: boolean;
  openMenu: boolean;
  deleting: boolean;
  copying: boolean;
  currentUserRole: 'owner' | 'member' | null;
  currentUserId: string;
  onToggleSelected: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentlyDelete: (id: string) => void;
  onCopy: (transaction: Transaction) => void;
  onRemove: (transaction: Transaction) => void;
};

export const TransactionRow = memo(function TransactionRow({
  transaction,
  purposeName,
  purposeIcon,
  expenseTypeName,
  expenseTypeIcon,
  paymentMethodName,
  paymentMethodIcon,
  recurringLabel = 'Định kỳ',
  plannedLabel = 'Dự kiến',
  showTrash,
  selectMode,
  selected,
  openMenu,
  deleting,
  copying,
  currentUserRole,
  currentUserId,
  onToggleSelected,
  onToggleMenu,
  onRestore,
  onPermanentlyDelete,
  onCopy,
  onRemove,
}: TransactionRowProps) {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const actionLabels = {
    restore: en ? 'Restore' : 'Khôi phục',
    permanentlyDelete: en ? 'Delete permanently' : 'Xóa vĩnh viễn',
    openActions: en ? 'Open actions for' : 'Thao tác với',
    closeActions: en ? 'Close actions for' : 'Đóng thao tác với',
    edit: en ? 'Edit' : 'Sửa',
    copy: en ? 'Copy' : 'Sao chép',
    delete: en ? 'Delete' : 'Xóa',
  };
  const tone = transaction.transactionType === 'Thu nhập'
    ? { rowClass: 'transaction-income-row', amountClass: 'text-[var(--success-strong)]' }
        : { rowClass: 'transaction-expense-row', amountClass: 'text-[var(--danger-strong)]' };
  const date = formatDateOnlyVi(transaction.transactionDate);
  const canDelete = canDeleteTransaction(transaction, currentUserRole, currentUserId);
  const desktopGridClass = selectMode
    ? 'md:grid-cols-[32px_minmax(0,5rem)_minmax(0,1.65fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.25fr)]'
    : 'md:grid-cols-[minmax(0,5rem)_minmax(0,1.65fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.25fr)]';
  const hasTwoDesktopActions = showTrash || canDelete;
  const desktopAmountGridClass = hasTwoDesktopActions ? 'grid-cols-[minmax(0,1fr)_88px]' : 'grid-cols-[minmax(0,1fr)_44px]';
  const desktopActionClass = hasTwoDesktopActions ? 'w-[88px] grid-cols-2' : 'w-11 grid-cols-1';

  return (
    <div className="transaction-row-shell">
      <article aria-label={`Giao dịch ${transaction.description}`} className={`transaction-card relative rounded-2xl border border-black/10 p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 md:hidden ${tone.rowClass}`}>
        <div className="flex items-start justify-between gap-3">
          {selectMode && <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--primary)]" aria-label={`Chọn giao dịch ${transaction.description}`} checked={selected} onChange={() => onToggleSelected(transaction.id)} />}
          <div className="min-w-0 flex-1">
            {showTrash ? <span className="block break-words text-base font-bold [overflow-wrap:anywhere]">{transaction.description}</span> : <Link to={`/giao-dich/${transaction.id}`} title={transaction.description} className="block break-words text-base font-bold active:opacity-70 [overflow-wrap:anywhere]">{transaction.description}</Link>}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><span>{date}</span>{transaction.status === 'Dự kiến' && <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{plannedLabel}</span>}{transaction.source === 'recurring' && <span className="ui-chip">{recurringLabel}</span>}</div>
          </div>
          <div className="flex shrink-0 items-start gap-1"><strong className={`pt-1 text-base ${tone.amountClass} ${showTrash ? 'line-through opacity-70' : ''}`}><Amount value={transaction.amount} /></strong>{showTrash && <><button type="button" className="grid size-11 place-items-center rounded-lg text-[var(--success-strong)] hover:bg-[var(--success-soft)]" aria-label={`${actionLabels.restore} ${transaction.description}`} title={actionLabels.restore} onClick={() => onRestore(transaction.id)}><RotateCcw size={18} aria-hidden="true" /></button><button type="button" className="grid size-11 place-items-center rounded-lg text-[var(--danger-strong)] hover:bg-[var(--danger-soft)]" aria-label={`${actionLabels.permanentlyDelete} ${transaction.description}`} title={actionLabels.permanentlyDelete} onClick={() => onPermanentlyDelete(transaction.id)}><Trash2 size={18} aria-hidden="true" /></button></>}{!showTrash && <button type="button" className="grid size-11 place-items-center rounded-lg hover:bg-[var(--surface-subtle)]" aria-label={`${openMenu ? actionLabels.closeActions : actionLabels.openActions} ${transaction.description}`} aria-expanded={openMenu} onClick={() => onToggleMenu(transaction.id)}><MoreHorizontal size={19} aria-hidden="true" /></button>}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5"><CatalogTag name={purposeName} icon={purposeIcon} /><CatalogTag name={expenseTypeName} icon={expenseTypeIcon} />{paymentMethodName !== '—' && <CatalogTag name={paymentMethodName} icon={paymentMethodIcon} />}</div>
        {openMenu && <div className="absolute right-3 top-12 z-10 min-w-40 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl" role="menu" aria-label={`${actionLabels.openActions} ${transaction.description}`}><Link className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-subtle)]" to={`/giao-dich/${transaction.id}`} onClick={() => onToggleMenu(transaction.id)} role="menuitem"><Pencil size={16} aria-hidden="true" />{actionLabels.edit}</Link><button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-subtle)]" disabled={copying} onClick={() => { onToggleMenu(transaction.id); onCopy(transaction); }} role="menuitem"><Copy size={16} aria-hidden="true" />{actionLabels.copy}</button>{canDelete && <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--danger-strong)] hover:bg-[var(--danger-soft)]" disabled={deleting} onClick={() => { onToggleMenu(transaction.id); onRemove(transaction); }} role="menuitem"><Trash2 size={16} aria-hidden="true" />{actionLabels.delete}</button>}</div>}
      </article>
      <div className={`transaction-table-row hidden w-full min-w-0 gap-1 border-t border-black/5 p-3 transition-colors hover:brightness-[.98] dark:border-white/5 dark:hover:brightness-110 md:grid md:items-center ${desktopGridClass} ${tone.rowClass}`}>
        {selectMode && <input type="checkbox" className="size-5 accent-[var(--primary)]" aria-label={`Chọn giao dịch ${transaction.description} trên bảng`} checked={selected} onChange={() => onToggleSelected(transaction.id)} />}
        <span className="min-w-0 whitespace-nowrap text-sm text-gray-500">{date}</span>
        <Link to={`/giao-dich/${transaction.id}`} title={transaction.description} className="min-w-0 truncate text-sm font-semibold hover:underline">{transaction.description}{transaction.status === 'Dự kiến' && <span className="ml-2 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{plannedLabel}</span>}{transaction.source === 'recurring' && <span className="ui-chip ml-2 align-middle text-[11px]">{recurringLabel}</span>}<small className="mt-1 block font-normal text-gray-500 md:hidden">{purposeName} · {expenseTypeName} · {paymentMethodName}</small></Link>
        <CatalogValue name={purposeName} icon={purposeIcon} /><CatalogValue name={expenseTypeName} icon={expenseTypeIcon} /><CatalogValue name={paymentMethodName} icon={paymentMethodIcon} />
        <div className={`grid min-w-0 items-center gap-1 ${desktopAmountGridClass}`}>
          <strong className={`transaction-row-amount min-w-0 truncate text-sm font-bold ${tone.amountClass}`}><Amount value={transaction.amount} /></strong>
          <span className={`transaction-row-actions grid shrink-0 items-center ${desktopActionClass}`}>{showTrash && <button type="button" aria-label={`${actionLabels.restore} ${transaction.description}`} title={actionLabels.restore} className="grid size-11 place-items-center text-[var(--success-strong)]" onClick={() => onRestore(transaction.id)}><RotateCcw size={17} aria-hidden="true" /></button>}{showTrash && <button type="button" aria-label={`${actionLabels.permanentlyDelete} ${transaction.description}`} title={actionLabels.permanentlyDelete} className="grid size-11 place-items-center text-[var(--danger-strong)]" onClick={() => onPermanentlyDelete(transaction.id)}><Trash2 size={17} aria-hidden="true" /></button>}<span className={showTrash ? 'hidden' : 'contents'}><button type="button" aria-label={`${actionLabels.copy} ${transaction.description}`} title={actionLabels.copy} className="grid size-11 place-items-center" disabled={copying} onClick={() => onCopy(transaction)}><Copy size={17} aria-hidden="true" /></button>{canDelete && <button type="button" aria-label={`${actionLabels.delete} ${transaction.description}`} title={actionLabels.delete} className="grid size-11 place-items-center text-[var(--danger-strong)]" disabled={deleting} onClick={() => onRemove(transaction)}><Trash2 size={17} aria-hidden="true" /></button>}</span></span>
        </div>
      </div>
    </div>
  );
}, (previous, next) => previous.transaction === next.transaction
  && previous.purposeName === next.purposeName
  && previous.purposeIcon === next.purposeIcon
  && previous.expenseTypeName === next.expenseTypeName
  && previous.expenseTypeIcon === next.expenseTypeIcon
  && previous.paymentMethodName === next.paymentMethodName
  && previous.paymentMethodIcon === next.paymentMethodIcon
  && previous.recurringLabel === next.recurringLabel
  && previous.plannedLabel === next.plannedLabel
  && previous.showTrash === next.showTrash
  && previous.selectMode === next.selectMode
  && previous.selected === next.selected
  && previous.openMenu === next.openMenu
  && previous.deleting === next.deleting
  && previous.copying === next.copying
  && previous.currentUserRole === next.currentUserRole
  && previous.currentUserId === next.currentUserId);

function CatalogTag({ name, icon }: { name: string; icon?: string }) {
  const Icon = getCatalogIcon(icon);
  return <span className="transaction-card-tag max-w-full gap-1.5 whitespace-normal break-words" title={name}><Icon className="catalog-tag-icon shrink-0" size={13} aria-hidden="true" /><span className="min-w-0 break-words [overflow-wrap:anywhere] leading-tight">{name}</span></span>;
}

function CatalogValue({ name, icon }: { name: string; icon?: string }) {
  const Icon = getCatalogIcon(icon);
  return <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm" title={name}><Icon className="catalog-value-icon shrink-0" size={15} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{name}</span></span>;
}

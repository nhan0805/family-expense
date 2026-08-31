import {
  ChevronDown,
  RotateCcw,
  Search,
  Trash2,
  Plus,
  Pencil,
  ListChecks,
  WalletCards,
  X,
  ArchiveRestore,
} from 'lucide-react';
import { EmptyState, TransactionListSkeleton } from '../components/AsyncStates';
import { TransactionRow } from '../components/TransactionRow';
import { useFeedback } from '../components/Feedback';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import {
  canDeleteTransaction,
  formatVnd,
  getTransactionTotalImpact,
  normalizeText,
  type Transaction,
} from '../lib/domain';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  fetchDeletedTransactionPage,
  fetchTransactionPage,
  fetchTransactionYears,
} from '../lib/transactionsApi';

type SortOption =
  'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'description-asc';
type TransactionFilters = {
  query: string;
  transactionType: string;
  status: string;
  purposeId: string;
  expenseTypeId: string;
  paymentMethodId: string;
  month: string;
  year: string;
  dateFrom: string;
  dateTo: string;
  sort: SortOption;
};
type BulkEditValues = {
  purposeId: string;
  expenseTypeId: string;
  paymentMethodId: string;
  status: string;
};
const emptyBulkEditValues: BulkEditValues = {
  purposeId: '',
  expenseTypeId: '',
  paymentMethodId: '',
  status: '',
};
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, '0'),
  label: `Tháng ${index + 1}`,
}));
const englishMonthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const getInitialTransactionPeriod = (
  monthParam: string | null,
  yearParam: string | null,
  now = new Date(),
) => {
  const legacyMonth = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthParam || '');
  const validMonth = /^(0[1-9]|1[0-2])$/.test(monthParam || '')
    ? monthParam || ''
    : '';
  const validYear = /^\d{4}$/.test(yearParam || '') ? yearParam || '' : '';
  if (legacyMonth)
    return { month: legacyMonth[2] || '', year: legacyMonth[1] || '' };
  if (validMonth || validYear) return { month: validMonth, year: validYear };
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  };
};

export const getInitialTransactionType = (value: string | null) =>
  value === 'Chi tiêu' || value === 'Thu nhập' ? value : '';

export const getTransactionListTone = (
  transactionType: Transaction['transactionType'],
) => {
  if (transactionType === 'Thu nhập')
    return {
      rowClass:
        'bg-gradient-to-r from-emerald-100/90 via-emerald-50/55 to-transparent dark:from-emerald-950/65 dark:via-emerald-950/25 dark:to-transparent',
      amountClass: 'text-emerald-700 dark:text-emerald-300',
      badgeClass:
        'border border-emerald-300 bg-emerald-200 text-emerald-950 shadow-sm dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100',
    };
  if (transactionType === 'Hoàn tiền')
    return {
      rowClass:
        'bg-gradient-to-r from-sky-100/90 via-sky-50/55 to-transparent dark:from-sky-950/65 dark:via-sky-950/25 dark:to-transparent',
      amountClass: 'text-sky-700 dark:text-sky-300',
      badgeClass:
        'border border-sky-300 bg-sky-200 text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-900 dark:text-sky-100',
    };
  if (transactionType === 'Tạm ứng')
    return {
      rowClass:
        'bg-gradient-to-r from-amber-100/90 via-amber-50/55 to-transparent dark:from-amber-950/65 dark:via-amber-950/25 dark:to-transparent',
      amountClass: 'text-amber-700 dark:text-amber-300',
      badgeClass:
        'border border-amber-300 bg-amber-200 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100',
    };
  return {
    rowClass:
      'bg-gradient-to-r from-rose-100/90 via-rose-50/55 to-transparent dark:from-rose-950/65 dark:via-rose-950/25 dark:to-transparent',
    amountClass: 'text-rose-700 dark:text-rose-300',
    badgeClass:
      'border border-rose-300 bg-rose-200 text-rose-950 shadow-sm dark:border-rose-700 dark:bg-rose-900 dark:text-rose-100',
  };
};

const transactionDateValue = (value: string) => {
  const normalized = String(value).trim().slice(0, 10);
  const timestamp = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const compareTransactions =
  (sort: SortOption) => (a: Transaction, b: Transaction) => {
    if (sort === 'date-asc' || sort === 'date-desc') {
      const aDate = transactionDateValue(a.transactionDate);
      const bDate = transactionDateValue(b.transactionDate);
      if (aDate === null && bDate === null) return a.id.localeCompare(b.id);
      if (aDate === null) return 1;
      if (bDate === null) return -1;
      const difference = sort === 'date-asc' ? aDate - bDate : bDate - aDate;
      return difference || a.id.localeCompare(b.id);
    }
    if (sort === 'amount-desc') return b.amount - a.amount;
    if (sort === 'amount-asc') return a.amount - b.amount;
    if (sort === 'description-asc')
      return a.description.localeCompare(b.description, 'vi');
    return 0;
  };

export const filterAndSortTransactions = (
  transactions: Transaction[],
  filters: TransactionFilters,
  includeDeleted = false,
) => {
  const normalizedQuery = normalizeText(filters.query);
  return transactions
    .filter((transaction) => {
      if (transaction.deletedAt && !includeDeleted) return false;
      if (
        normalizedQuery &&
        !normalizeText(
          `${transaction.description} ${transaction.note || ''}`,
        ).includes(normalizedQuery)
      )
        return false;
      if (
        filters.transactionType &&
        transaction.transactionType !== filters.transactionType
      )
        return false;
      if (filters.status && transaction.status !== filters.status) return false;
      if (filters.purposeId && transaction.purposeId !== filters.purposeId)
        return false;
      if (
        filters.expenseTypeId &&
        transaction.expenseTypeId !== filters.expenseTypeId
      )
        return false;
      if (
        filters.paymentMethodId &&
        transaction.paymentMethodId !== filters.paymentMethodId
      )
        return false;
      if (
        filters.month &&
        transaction.transactionDate.slice(5, 7) !== filters.month
      )
        return false;
      if (
        filters.year &&
        transaction.transactionDate.slice(0, 4) !== filters.year
      )
        return false;
      if (filters.dateFrom && transaction.transactionDate < filters.dateFrom)
        return false;
      if (filters.dateTo && transaction.transactionDate > filters.dateTo)
        return false;
      return true;
    })
    .sort(compareTransactions(filters.sort));
};

export function Transactions() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const { askConfirm, notify } = useFeedback();
  const queryClient = useQueryClient();
  const {
    transactions,
    setTransactions,
    purposes,
    expenseTypes,
    paymentMethods,
    familyId,
    currentUserId,
    currentUserRole,
  } = useApp();
  const [searchParams] = useSearchParams();
  const initialPeriod = getInitialTransactionPeriod(
    searchParams.get('month'),
    searchParams.get('year'),
  );
  const initialMonth = initialPeriod.month;
  const initialYear = initialPeriod.year;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [transactionType, setTransactionType] = useState(() =>
    getInitialTransactionType(searchParams.get('transactionType')),
  );
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [purposeId, setPurposeId] = useState(() => searchParams.get('purposeId') || '');
  const [expenseTypeId, setExpenseTypeId] = useState(() => searchParams.get('expenseTypeId') || '');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<SortOption>('date-desc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditBusy, setBulkEditBusy] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState<BulkEditValues>(emptyBulkEditValues);
  const [showTrash, setShowTrash] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);
  const localAvailableYears = Array.from(
    new Set(
      transactions
        .map((transaction) => transaction.transactionDate.slice(0, 4))
        .filter((item) => /^\d{4}$/.test(item)),
    ),
  ).sort((a, b) => Number(b) - Number(a));

  const localRows = useMemo(
    () =>
      filterAndSortTransactions(transactions, {
        query,
        transactionType,
        status,
        purposeId,
        expenseTypeId,
        paymentMethodId,
        month,
        year,
        dateFrom,
        dateTo,
        sort,
      }),
    [
      transactions,
      query,
      transactionType,
      purposeId,
      expenseTypeId,
      paymentMethodId,
      month,
      year,
      dateFrom,
      dateTo,
      sort,
      status,
    ],
  );
  const serverFilters = useMemo(
    () => ({
      query: debouncedQuery,
      transactionType,
      status,
      purposeId,
      expenseTypeId,
      paymentMethodId,
      month,
      year,
      dateFrom,
      dateTo,
      sort,
    }),
    [
      debouncedQuery,
      transactionType,
      purposeId,
      expenseTypeId,
      paymentMethodId,
      month,
      year,
      dateFrom,
      dateTo,
      sort,
      status,
    ],
  );
  const transactionQuery = useInfiniteQuery({
    queryKey: ['transactions', familyId, serverFilters],
    queryFn: ({ pageParam }) =>
      fetchTransactionPage(familyId, serverFilters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: isSupabaseConfigured && Boolean(familyId) && !showTrash,
  });
  const trashQuery = useQuery({
    queryKey: ['trash', familyId, serverFilters],
    queryFn: () => fetchDeletedTransactionPage(familyId, serverFilters, 0),
    enabled: isSupabaseConfigured && Boolean(familyId) && showTrash,
  });
  const yearsQuery = useQuery({
    queryKey: ['transaction-years', familyId],
    queryFn: () => fetchTransactionYears(familyId),
    enabled: isSupabaseConfigured && Boolean(familyId),
    staleTime: 5 * 60_000,
  });
  const trashFilters = { query, transactionType, status, purposeId, expenseTypeId, paymentMethodId, month, year, dateFrom, dateTo, sort } satisfies TransactionFilters;
  const localTrashRows = useMemo(() => filterAndSortTransactions(transactions.filter((item) => item.deletedAt && (currentUserRole === 'owner' || item.createdBy === currentUserId)), trashFilters, true), [transactions, currentUserRole, currentUserId, trashFilters]);
  const rows = showTrash
    ? (isSupabaseConfigured ? trashQuery.data?.rows || [] : localTrashRows)
    : (isSupabaseConfigured ? transactionQuery.data?.pages.flatMap((page) => page.rows) || [] : localRows);
  const availableYearsFromData = isSupabaseConfigured
    ? yearsQuery.data || []
    : localAvailableYears;
  const availableYears = Array.from(
    new Set([initialYear, ...availableYearsFromData].filter(Boolean)),
  ).sort((a, b) => Number(b) - Number(a));
  const resultKey = [
    showTrash,
    query,
    transactionType,
    purposeId,
    expenseTypeId,
    paymentMethodId,
    month,
    year,
    dateFrom,
    dateTo,
    sort,
  ].join('|');

  const hasFilters = Boolean(
    query ||
    transactionType ||
    status ||
    purposeId ||
    expenseTypeId ||
    paymentMethodId ||
    month ||
    year ||
    dateFrom ||
    dateTo ||
    sort !== 'date-desc',
  );
  const activeFilterCount = [
    transactionType,
    status,
    purposeId,
    expenseTypeId,
    paymentMethodId,
    month,
    year,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;
  const filterChips = [
    transactionType && { key: 'transactionType', label: transactionType, clear: () => setTransactionType('') },
    status && { key: 'status', label: status, clear: () => setStatus('') },
    purposeId && { key: 'purposeId', label: purposes.find((item) => item.id === purposeId)?.name || 'Mục đích', clear: () => setPurposeId('') },
    expenseTypeId && { key: 'expenseTypeId', label: expenseTypes.find((item) => item.id === expenseTypeId)?.name || 'Danh mục', clear: () => setExpenseTypeId('') },
    paymentMethodId && { key: 'paymentMethodId', label: paymentMethods.find((item) => item.id === paymentMethodId)?.name || 'Thanh toán', clear: () => setPaymentMethodId('') },
    month && { key: 'month', label: en ? (englishMonthNames[Number(month) - 1] || `Month ${Number(month)}`) : `Tháng ${Number(month)}`, clear: () => setMonth('') },
    year && { key: 'year', label: `${en ? 'Year' : 'Năm'} ${year}`, clear: () => setYear('') },
    dateFrom && { key: 'dateFrom', label: `${en ? 'From' : 'Từ'} ${new Date(`${dateFrom}T00:00:00`).toLocaleDateString('vi-VN')}`, clear: () => setDateFrom('') },
    dateTo && { key: 'dateTo', label: `${en ? 'To' : 'Đến'} ${new Date(`${dateTo}T00:00:00`).toLocaleDateString('vi-VN')}`, clear: () => setDateTo('') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const filteredTotal = isSupabaseConfigured
    ? (showTrash ? rows.reduce((total, transaction) => total + getTransactionTotalImpact(transaction.amount, transaction.transactionType), 0) : transactionQuery.data?.pages[0]?.totalAmount || 0)
    : rows.reduce(
        (total, transaction) =>
          total +
          getTransactionTotalImpact(
            transaction.amount,
            transaction.transactionType,
          ),
        0,
      );
  const netIsPositive = filteredTotal > 0;
  const netIsNegative = filteredTotal < 0;
  const resetFilters = () => {
    setQuery('');
    setTransactionType('');
    setStatus('');
    setPurposeId('');
    setExpenseTypeId('');
    setPaymentMethodId('');
    setMonth('');
    setYear('');
    setDateFrom('');
    setDateTo('');
    setSort('date-desc');
  };
  const restoreSelected = async () => {
    const restoreRows = rows.filter((item) => selectedIds.has(item.id));
    if (!restoreRows.length) return;
    if (!await askConfirm({ title: 'Khôi phục giao dịch?', description: `${restoreRows.length} giao dịch sẽ quay lại danh sách chính và được tính lại vào báo cáo.`, confirmLabel: 'Khôi phục' })) return;
    setBulkEditBusy(true);
    setDeleteError('');
    if (isSupabaseConfigured) {
      let request = supabase.from('transactions').update({ deleted_at: null, updated_by: currentUserId }).eq('family_id', familyId).in('id', restoreRows.map((item) => item.id)).not('deleted_at', 'is', null);
      if (currentUserRole === 'member') request = request.eq('created_by', currentUserId);
      const { data, error } = await request.select('id');
      if (error || data?.length !== restoreRows.length) {
        setBulkEditBusy(false);
        setDeleteError(error?.message || 'Một số giao dịch không thể khôi phục.');
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trash', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] }),
      ]);
    } else {
      setTransactions((items) => items.map((item) => selectedIds.has(item.id) ? { ...item, deletedAt: null } : item));
    }
    const count = restoreRows.length;
    setBulkEditBusy(false);
    setSelectedIds(new Set());
    notify(`Đã khôi phục ${count} giao dịch.`);
  };
  const permanentlyDeleteSelected = async () => {
    const deleteRows = rows.filter((item) => selectedIds.has(item.id));
    if (!deleteRows.length) return;
    if (!await askConfirm({ title: 'Xóa vĩnh viễn?', description: `${deleteRows.length} giao dịch sẽ bị xóa khỏi cơ sở dữ liệu và không thể khôi phục.`, confirmLabel: 'Xóa vĩnh viễn', danger: true })) return;
    setBulkEditBusy(true);
    setDeleteError('');
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('permanently_delete_transactions', { p_family_id: familyId, p_transaction_ids: deleteRows.map((item) => item.id) });
      if (error || Number(data) !== deleteRows.length) {
        setDeleteError(error?.message || 'Một số giao dịch không thể xóa vĩnh viễn.');
        setBulkEditBusy(false);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trash', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] }),
      ]);
    } else {
      setTransactions((items) => items.filter((item) => !selectedIds.has(item.id)));
    }
    const count = deleteRows.length;
    setBulkEditBusy(false);
    setSelectedIds(new Set());
    notify(`Đã xóa vĩnh viễn ${count} giao dịch.`);
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 100) next.add(id);
      else notify('Mỗi lần chỉ có thể sửa tối đa 100 giao dịch.', 'info');
      return next;
    });
  };
  const closeSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkEditOpen(false);
    setBulkEditValues(emptyBulkEditValues);
  };
  const selectedRows = rows.filter((item) => selectedIds.has(item.id));
  const canBulkDelete = selectedRows.length > 0 && selectedRows.every((item) => canDeleteTransaction(item, currentUserRole, currentUserId));
  const bulkDelete = async () => {
    if (!canBulkDelete) {
      setDeleteError('Bạn chỉ có thể xóa giao dịch do chính mình tạo.');
      return;
    }
    if (!await askConfirm({ title: 'Xóa nhiều giao dịch?', description: `${selectedRows.length} giao dịch sẽ được chuyển vào trạng thái đã xóa. Thao tác này không xóa dữ liệu vĩnh viễn.`, confirmLabel: 'Xóa giao dịch', danger: true })) return;
    const deletedAt = new Date().toISOString();
    setBulkEditBusy(true);
    setDeleteError('');
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('transactions')
        .update({ deleted_at: deletedAt, updated_by: currentUserId })
        .eq('family_id', familyId)
        .in('id', selectedRows.map((item) => item.id))
        .is('deleted_at', null)
        .select('id');
      if (error || data?.length !== selectedRows.length) {
        setBulkEditBusy(false);
        setDeleteError(error?.message || 'Một số giao dịch không còn tồn tại hoặc bạn không có quyền xóa.');
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] }),
      ]);
    } else {
      setTransactions((items) => items.map((item) => selectedIds.has(item.id) ? { ...item, deletedAt } : item));
    }
    const deletedCount = selectedRows.length;
    setBulkEditBusy(false);
    closeSelectMode();
    notify(`Đã xóa ${deletedCount} giao dịch.`);
  };
  const applyBulkEdit = async () => {
    if (selectedIds.size === 0) return;
    const selectedChanges = Object.entries(bulkEditValues).filter(([, value]) => value !== '');
    if (selectedChanges.length === 0) {
      setDeleteError('Hãy chọn ít nhất một trường cần thay đổi.');
      return;
    }
    const payload: Record<string, string | null> = {};
    const localChanges: Partial<Transaction> = {};
    const put = (databaseKey: string, localKey: keyof Transaction, value: string) => {
      const normalized = value === '__clear__' ? null : value;
      payload[databaseKey] = normalized;
      Object.assign(localChanges, { [localKey]: normalized });
    };
    if (bulkEditValues.purposeId) put('purpose_id', 'purposeId', bulkEditValues.purposeId);
    if (bulkEditValues.expenseTypeId) put('expense_type_id', 'expenseTypeId', bulkEditValues.expenseTypeId);
    if (bulkEditValues.paymentMethodId) put('payment_method_id', 'paymentMethodId', bulkEditValues.paymentMethodId);
    if (bulkEditValues.status) put('status', 'status', bulkEditValues.status);
    setBulkEditBusy(true);
    setDeleteError('');
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('bulk_update_transactions', {
        p_family_id: familyId,
        p_transaction_ids: Array.from(selectedIds),
        p_changes: payload,
      });
      if (error || Number(data) !== selectedIds.size) {
        setBulkEditBusy(false);
        setDeleteError(error?.message || 'Một số giao dịch không còn tồn tại hoặc bạn không có quyền sửa.');
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', familyId] }),
      ]);
    } else {
      setTransactions((items) => items.map((item) => selectedIds.has(item.id) ? { ...item, ...localChanges } : item));
    }
    const updatedCount = selectedIds.size;
    setBulkEditBusy(false);
    closeSelectMode();
    notify(`Đã cập nhật ${updatedCount} giao dịch.`);
  };
  const remove = async (id: string) => {
    const transaction = rows.find((item) => item.id === id);
    if (
      !transaction ||
      !canDeleteTransaction(transaction, currentUserRole, currentUserId)
    ) {
      setDeleteError('Bạn chỉ có thể xóa giao dịch do chính mình tạo.');
      return;
    }
    if (!await askConfirm({ title: 'Xóa giao dịch?', description: `Giao dịch “${transaction.description}” sẽ được chuyển vào trạng thái đã xóa.`, confirmLabel: 'Xóa giao dịch', danger: true })) return;
    const deletedAt = new Date().toISOString();
    setDeletingId(id);
    setDeleteError('');
    if (isSupabaseConfigured) {
      let query = supabase
        .from('transactions')
        .update({ deleted_at: deletedAt, updated_by: currentUserId })
        .eq('id', id)
        .eq('family_id', familyId)
        .is('deleted_at', null);
      if (currentUserRole === 'member')
        query = query.eq('created_by', currentUserId);
      const { data, error } = await query.select('id').maybeSingle();
      if (error || !data) {
        setDeletingId(null);
        setDeleteError(
          error?.message || 'Giao dịch không còn tồn tại hoặc đã bị xóa.',
        );
        return;
      }
    }
    if (isSupabaseConfigured) {
      await queryClient.invalidateQueries({
        queryKey: ['transactions', familyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', familyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['transaction-years', familyId],
      });
    } else
      setTransactions((items) =>
        items.map((item) => (item.id === id ? { ...item, deletedAt } : item)),
      );
    setDeletingId(null);
    notify('Đã xóa giao dịch.');
  };

  const copyTransaction = async (transaction: Transaction) => {
    setCopyingId(transaction.id);
    setDeleteError('');
    const copy = {
      ...transaction,
      description: `${transaction.description} (bản sao)`,
      source: 'manual' as const,
      sourceReference: null,
      aiGenerated: false,
    };
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          family_id: familyId,
          transaction_date: copy.transactionDate,
          transaction_type: copy.transactionType,
          status: copy.status,
          description: copy.description,
          amount: copy.amount,
          purpose_id: copy.purposeId,
          expense_type_id: copy.expenseTypeId,
          event_id: copy.eventId || null,
          beneficiary_id: copy.beneficiaryId || null,
          payment_method_id: copy.paymentMethodId || null,
          account_id: copy.accountId || null,
          note: copy.note || null,
          source: 'manual',
          source_reference: null,
          ai_generated: false,
          created_by: currentUserId,
          updated_by: currentUserId,
        })
        .select('id,created_at')
        .single();
      if (error || !data) {
        setCopyingId(null);
        setDeleteError(
          error?.message || 'Không thể sao chép giao dịch vào database.',
        );
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['transactions', familyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', familyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['transaction-years', familyId],
      });
    } else {
      setTransactions((items) => [
        { ...copy, id: crypto.randomUUID(), deletedAt: null },
        ...items,
      ]);
    }
    setCopyingId(null);
    notify('Đã tạo bản sao giao dịch.');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">{en ? 'Transactions' : 'Giao dịch'}</h2>
      </div>
      <section
        aria-label={en ? 'Net value for current filters' : 'Giá trị ròng theo bộ lọc'}
        className={`order-2 flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${netIsPositive ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:border-rose-900/40 dark:from-rose-950/40 dark:to-white/5' : netIsNegative ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-white/5' : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white dark:border-slate-700 dark:from-slate-900/40 dark:to-white/5'}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm ${netIsPositive ? 'bg-rose-700' : netIsNegative ? 'bg-emerald-700' : 'bg-slate-600'}`}>
            <WalletCards size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm font-semibold text-gray-600 dark:text-gray-300">
              {en ? 'Net value for current filters' : 'Giá trị ròng theo bộ lọc'}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className={`whitespace-nowrap text-2xl font-extrabold tracking-tight sm:text-3xl ${netIsPositive ? 'text-rose-700 dark:text-rose-300' : netIsNegative ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
            {formatVnd(Math.abs(filteredTotal))}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {netIsPositive ? (en ? 'Spent more' : 'Chi nhiều hơn') : netIsNegative ? (en ? 'Earned more' : 'Thu nhiều hơn') : (en ? 'Balanced' : 'Cân bằng')} · {isSupabaseConfigured
              ? `${Number(transactionQuery.data?.pages[0]?.totalCount || 0).toLocaleString('vi-VN')} ${en ? 'matching transactions' : 'giao dịch phù hợp'}`
              : `${rows.length.toLocaleString('vi-VN')} ${en ? 'matching transactions' : 'giao dịch phù hợp'}`}
          </p>
        </div>
      </section>
      {deleteError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {deleteError}
        </p>
      )}
      {transactionQuery.isError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {en ? 'Could not load transactions. Please try again.' : 'Không thể tải danh sách giao dịch. Vui lòng thử lại.'}
        </p>
      )}

      <section aria-label={en ? 'Transaction search and filters' : 'Tìm kiếm và bộ lọc giao dịch'} className="order-1 card space-y-3 p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px]">
          <label className="col-span-2 md:col-span-1">
            <span className="label">{en ? 'Search' : 'Tìm kiếm'}</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                size={18}
              />
              <input
                className="field"
                style={{ paddingLeft: '2.75rem' }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={en ? 'Search description or notes…' : 'Tìm nội dung hoặc ghi chú…'}
              />
            </div>
          </label>
          <label>
            <span className="label">{en ? 'Sort' : 'Sắp xếp'}</span>
            <select
              className="field"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
            >
              <option value="date-desc">{en ? 'Newest date' : 'Ngày mới nhất'}</option>
              <option value="date-asc">{en ? 'Oldest date' : 'Ngày cũ nhất'}</option>
              <option value="amount-desc">{en ? 'Highest amount' : 'Số tiền cao nhất'}</option>
              <option value="amount-asc">{en ? 'Lowest amount' : 'Số tiền thấp nhất'}</option>
              <option value="description-asc">{en ? 'Description A–Z' : 'Nội dung A–Z'}</option>
            </select>
          </label>
        </div>

        {filterChips.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap" aria-label={en ? 'Active filters' : 'Bộ lọc đang áp dụng'}>{filterChips.map((chip) => <button type="button" key={chip.key} onClick={chip.clear} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e3f2e9] px-3 py-1.5 text-xs font-semibold text-[#145c43] transition hover:bg-[#d3eadd] dark:bg-emerald-950/60 dark:text-emerald-200"><span>{chip.label}</span><X size={13} aria-hidden="true"/><span className="sr-only">{en ? 'Remove filter' : 'Bỏ bộ lọc'} {chip.label}</span></button>)}</div>}

        <details className="group border-t border-black/10 pt-3 dark:border-white/10">
          <summary className="btn-secondary flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span>{en ? 'Detailed filters' : 'Bộ lọc chi tiết'}{activeFilterCount ? ` (${activeFilterCount})` : ''}</span>
            <ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={18} aria-hidden="true" />
          </summary>
          <div className="ui-enter mt-3 grid gap-3 md:grid-cols-4">
          <label>
            <span className="label">{en ? 'Transaction type' : 'Loại giao dịch'}</span>
            <select className="field" value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option value="">{en ? 'All types' : 'Tất cả loại'}</option><option value="Chi tiêu">{en ? 'Money out' : 'Tiền ra'}</option><option value="Thu nhập">{en ? 'Money in' : 'Tiền vào'}</option></select>
          </label>
          <label>
            <span className="label">{en ? 'Status' : 'Trạng thái'}</span>
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{en ? 'All statuses' : 'Tất cả trạng thái'}</option>
              <option value="Thực tế">{en ? 'Actual' : 'Thực tế'}</option>
              <option value="Dự kiến">{en ? 'Planned' : 'Dự kiến'}</option>
            </select>
          </label>
          <label>
            <span className="label">{en ? 'Purpose' : 'Mục đích'}</span>
            <select
              className="field"
              value={purposeId}
              onChange={(event) => setPurposeId(event.target.value)}
            >
              <option value="">{en ? 'All purposes' : 'Tất cả mục đích'}</option>
              {purposes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{en ? 'Category' : 'Danh mục'}</span>
            <select
              className="field"
              value={expenseTypeId}
              onChange={(event) => setExpenseTypeId(event.target.value)}
            >
              <option value="">{en ? 'All categories' : 'Tất cả danh mục'}</option>
              {expenseTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{en ? 'Payment method' : 'Phương thức thanh toán'}</span>
            <select
              className="field"
              value={paymentMethodId}
              onChange={(event) => setPaymentMethodId(event.target.value)}
            >
              <option value="">{en ? 'All payment methods' : 'Tất cả phương thức'}</option>
              {paymentMethods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{en ? 'Month' : 'Tháng'}</span>
            <select
              className="field"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              <option value="">{en ? 'All months' : 'Tất cả tháng'}</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {en ? englishMonthNames[Number(option.value) - 1] : option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{en ? 'Year' : 'Năm'}</span>
            <select
              className="field"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="">{en ? 'All years' : 'Tất cả năm'}</option>
              {availableYears.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="label">{en ? 'From date' : 'Từ ngày'}</span>
            <input
              className="field"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="min-w-0">
            <span className="label">{en ? 'To date' : 'Đến ngày'}</span>
            <input
              className="field"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          <div>
            <span className="label invisible" aria-hidden="true">
              {en ? 'Actions' : 'Thao tác'}
            </span>
            <button
              className="btn-secondary flex w-full items-center justify-center gap-2"
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              <RotateCcw size={17} />
              {en ? 'Clear filters' : 'Xóa bộ lọc'}
            </button>
          </div>
          </div>
        </details>
      </section>

      <div className="order-3 flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white/70 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
        <p className="text-base font-semibold text-gray-600 dark:text-gray-300">{showTrash ? (en ? 'Trash' : 'Thùng rác') : (en ? 'Transaction list' : 'Danh sách giao dịch')}</p>
        <div className="flex items-center gap-0">
          <button type="button" className={`grid size-10 place-items-center rounded-xl transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-200/50 ${selectMode ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-gray-300 dark:hover:bg-white/10'}`} aria-label={selectMode ? (en ? 'Close multi-select' : 'Đóng chọn nhiều giao dịch') : (en ? 'Select multiple transactions' : 'Chọn nhiều giao dịch')} title={selectMode ? (en ? 'Close multi-select' : 'Đóng chọn nhiều') : (en ? 'Select multiple transactions' : 'Chọn nhiều giao dịch')} aria-pressed={selectMode} onClick={() => selectMode ? closeSelectMode() : setSelectMode(true)}><ListChecks size={21}/></button>
          <button type="button" className={`flex h-10 items-center justify-center gap-1 rounded-xl px-1 transition-colors focus:outline-none focus:ring-4 focus:ring-amber-200/50 ${showTrash ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700 dark:text-gray-300 dark:hover:bg-white/10'}`} aria-label={showTrash ? (en ? 'Close trash' : 'Đóng giao dịch đã xóa') : (en ? 'View trash' : 'Xem giao dịch đã xóa')} title={showTrash ? (en ? 'Close trash' : 'Đóng giao dịch đã xóa') : (en ? 'View trash' : 'Xem giao dịch đã xóa')} aria-pressed={showTrash} onClick={() => { closeSelectMode(); setShowTrash((value) => !value); }}><ArchiveRestore size={19}/><span className="hidden text-sm font-semibold sm:inline">{en ? 'Trash' : 'Đã xóa'}</span></button>
        </div>
      </div>
      {selectMode && (
        <div className="order-3 sticky top-2 z-40 flex w-full items-center gap-2 rounded-xl border border-emerald-900/15 bg-emerald-50/95 p-2.5 shadow-md backdrop-blur dark:border-white/15 dark:bg-[#17251f]/95">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{en ? `Selected ${selectedIds.size} transaction(s)` : `Đã chọn ${selectedIds.size} giao dịch`}</p><p className="hidden text-xs text-gray-500 sm:block">{en ? 'Up to 100 transactions per batch' : 'Tối đa 100 giao dịch mỗi lần'}</p></div>
          <button type="button" className="btn-secondary shrink-0 px-3 text-sm" onClick={() => setSelectedIds(new Set(rows.slice(0, 100).map((item) => item.id)))}>{en ? 'Select all' : 'Chọn tất cả'}</button>
          {showTrash && <button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-sm" disabled={rows.length === 0 || bulkEditBusy} onClick={() => { setSelectedIds(new Set(rows.slice(0, 100).map((item) => item.id))); window.setTimeout(() => void permanentlyDeleteSelected(), 0); }} aria-label={en ? 'Delete all transactions in trash' : 'Xóa tất cả giao dịch trong thùng rác'} title={en ? 'Delete all transactions in trash' : 'Xóa tất cả giao dịch trong thùng rác'}><Trash2 size={18}/></button>}
          {showTrash ? <button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#155e46] text-white" disabled={selectedIds.size === 0 || bulkEditBusy} onClick={() => void restoreSelected()} aria-label={en ? 'Restore selected transactions' : 'Khôi phục các giao dịch đã chọn'} title={en ? 'Restore selected transactions' : 'Khôi phục các giao dịch đã chọn'}><RotateCcw size={18}/></button> : <><button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#155e46] text-white" disabled={selectedIds.size === 0 || bulkEditBusy} onClick={() => { setDeleteError(''); setBulkEditOpen(true); }} aria-label={en ? 'Edit selected transactions' : 'Sửa các giao dịch đã chọn'} title={en ? 'Edit selected transactions' : 'Sửa các giao dịch đã chọn'}><Pencil size={18}/></button><button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-600 text-white" disabled={!canBulkDelete || bulkEditBusy} onClick={() => void bulkDelete()} aria-label={canBulkDelete ? (en ? 'Delete selected transactions' : 'Xóa các giao dịch đã chọn') : (en ? 'You can only delete transactions you created' : 'Chỉ có thể xóa giao dịch do bạn tạo')} title={canBulkDelete ? (en ? 'Delete selected transactions' : 'Xóa các giao dịch đã chọn') : (en ? 'You can only delete transactions you created' : 'Chỉ có thể xóa giao dịch do bạn tạo')}><Trash2 size={18}/></button></>}
        </div>
      )}
      <div key={resultKey} className="order-4 space-y-2 overflow-visible md:space-y-0 md:overflow-x-auto md:rounded-2xl md:border md:border-[#e3e7df] md:bg-white md:shadow-sm dark:md:border-[#33463f] dark:md:bg-[#17251f]">
        <div className={`hidden w-max min-w-[980px] gap-1 rounded-t-2xl bg-[#eef2ed] p-3 text-sm font-bold dark:bg-white/5 md:grid ${selectMode ? 'grid-cols-[32px_80px_minmax(160px,1fr)_130px_120px_145px_110px_70px]' : 'grid-cols-[80px_minmax(160px,1fr)_130px_120px_145px_110px_70px]'}`}>
          {selectMode && <input type="checkbox" className="size-5 accent-[#155e46]" aria-label={en ? 'Select all visible transactions' : 'Chọn tất cả giao dịch đang hiển thị'} checked={rows.length > 0 && rows.slice(0, 100).every((item) => selectedIds.has(item.id))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(rows.slice(0, 100).map((item) => item.id)) : new Set())} />}
          <span>{en ? 'Date' : 'Ngày'}</span>
          <span>{en ? 'Description' : 'Nội dung'}</span>
          <span>{en ? 'Purpose' : 'Mục đích'}</span>
          <span>{en ? 'Category' : 'Danh mục'}</span>
          <span>{en ? 'Payment method' : 'Phương thức'}</span>
          <span>{en ? 'Amount' : 'Số tiền'}</span>
          <span></span>
        </div>
        {rows.map((transaction) => {
          const purposeName =
            purposes.find((item) => item.id === transaction.purposeId)?.name ||
            '—';
          const expenseTypeName =
            expenseTypes.find((item) => item.id === transaction.expenseTypeId)
              ?.name || '—';
          const paymentMethodName =
            paymentMethods.find(
              (item) => item.id === transaction.paymentMethodId,
            )?.name || '—';
          return <TransactionRow key={transaction.id} transaction={transaction} purposeName={purposeName} expenseTypeName={expenseTypeName} paymentMethodName={paymentMethodName} showTrash={showTrash} selectMode={selectMode} selected={selectedIds.has(transaction.id)} openMenu={openMenuId === transaction.id} deleting={deletingId === transaction.id} copying={copyingId === transaction.id} currentUserRole={currentUserRole} currentUserId={currentUserId} onToggleSelected={toggleSelected} onSetSelected={setSelectedIds} onToggleMenu={(id) => setOpenMenuId((value) => value === id ? null : id)} onRestore={() => void restoreSelected()} onPermanentlyDelete={() => void permanentlyDeleteSelected()} onCopy={(item) => void copyTransaction(item)} onRemove={(id) => void remove(id)} />;
        })}
        {((showTrash ? trashQuery.isPending : transactionQuery.isPending) && isSupabaseConfigured) && <TransactionListSkeleton/>}
        {rows.length === 0 && !transactionQuery.isPending && (
          hasFilters
            ? <EmptyState title={en ? 'No matching transactions' : 'Không tìm thấy giao dịch phù hợp'} description={en ? 'Try changing the search term, date range or category filter.' : 'Hãy thử thay đổi từ khóa, thời gian hoặc danh mục lọc.'} action={<button className="btn-secondary" onClick={resetFilters}>{en ? 'Clear filters' : 'Xóa bộ lọc'}</button>}/>
            : <EmptyState title={en ? 'No transactions yet' : 'Chưa có giao dịch'} description={en ? 'Add your first transaction to start managing family finances.' : 'Thêm giao dịch đầu tiên để bắt đầu quản lý thu chi gia đình.'} action={<Link className="btn-primary inline-flex items-center gap-2" to="/giao-dich/moi"><Plus size={17}/>{en ? 'Add transaction' : 'Thêm giao dịch'}</Link>}/>
        )}
      </div>
      {!showTrash && isSupabaseConfigured && transactionQuery.hasNextPage && (
        <button
          className="order-5 btn-secondary mx-auto block"
          disabled={transactionQuery.isFetchingNextPage}
          onClick={() => void transactionQuery.fetchNextPage()}
        >
          {transactionQuery.isFetchingNextPage
            ? (en ? 'Loading…' : 'Đang tải…')
            : (en ? 'Load more transactions' : 'Tải thêm giao dịch')}
        </button>
      )}
      {bulkEditOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-start bg-black/35 p-3 sm:p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="bulk-edit-title" className="mt-32 max-h-[calc(100vh-8rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-[#17251f] sm:mt-20 sm:max-h-[78vh] sm:translate-x-32 sm:rounded-3xl sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 id="bulk-edit-title" className="text-xl font-extrabold">Sửa {selectedIds.size} giao dịch</h2><p className="mt-1 text-sm text-gray-500">Chỉ các trường có giá trị mới sẽ được cập nhật.</p></div><button type="button" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Đóng sửa hàng loạt" onClick={() => setBulkEditOpen(false)}><X size={20}/></button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <BulkSelect label="Mục đích" value={bulkEditValues.purposeId} onChange={(value) => setBulkEditValues((current) => ({ ...current, purposeId: value }))} options={purposes} />
              <BulkSelect label="Danh mục" value={bulkEditValues.expenseTypeId} onChange={(value) => setBulkEditValues((current) => ({ ...current, expenseTypeId: value }))} options={expenseTypes} />
              <BulkSelect label="Phương thức thanh toán" value={bulkEditValues.paymentMethodId} onChange={(value) => setBulkEditValues((current) => ({ ...current, paymentMethodId: value }))} options={paymentMethods} />
              <BulkSelect label="Trạng thái" value={bulkEditValues.status} onChange={(value) => setBulkEditValues((current) => ({ ...current, status: value }))} options={[{ id: 'Thực tế', name: 'Thực tế' }, { id: 'Dự kiến', name: 'Dự kiến' }]} />
            </div>
            <div className="mt-4 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><strong>Xem trước:</strong> {Object.values(bulkEditValues).filter(Boolean).length ? `${selectedIds.size} giao dịch · ${Object.values(bulkEditValues).filter(Boolean).length} trường sẽ cập nhật.` : 'Chưa chọn trường nào để thay đổi.'}</div>
            {deleteError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{deleteError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" className="btn-secondary" disabled={bulkEditBusy} onClick={() => setBulkEditOpen(false)}>Hủy</button><button type="button" className="btn-primary" disabled={bulkEditBusy || Object.values(bulkEditValues).every((value) => !value)} onClick={() => void applyBulkEdit()}>{bulkEditBusy ? 'Đang cập nhật…' : 'Xác nhận cập nhật'}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function BulkSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
}) {
  return (
    <label className="min-w-0">
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Không thay đổi</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

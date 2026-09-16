import {
  Archive,
  Banknote,
  ChevronDown,
  Coins,
  Landmark,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, PageSkeleton } from '../components/AsyncStates';
import { useFeedback } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import {
  formatDateOnlyVi,
  formatVnd,
  getCatalogDisplayName,
} from '../lib/domain';
import {
  archiveGoldAsset,
  archiveSavingsAccount,
  deleteGoldAsset,
  deleteSavingsAccount,
  fetchAssetData,
  fetchAssetSummary,
  recordGoldSale,
  recordSavingsMovement,
  setGoldBuybackPrice,
  upsertGoldAsset,
  upsertSavingsAccount,
} from '../lib/assetsApi';
import {
  fetchAutomaticTransactionDefaults,
} from '../lib/automaticTransactionDefaultsApi';
import {
  createSystemAutomaticTransactionDefaults,
  sanitizeAutomaticTransactionDefaults,
  type AutomaticTransactionKey,
} from '../lib/automaticTransactionDefaults';
import {
  buildLocalAssetSummary,
  canManageAssets,
  calculateSavingsMaturityDate,
  daysUntilMaturity,
  expectedSavingsInterest,
  expectedSavingsInterestToDate,
  goldCostValue,
  goldEstimatedValue,
  goldPurchaseAmount,
  goldSaleInputSchema,
  goldAssetInputSchema,
  goldBuybackPriceInputSchema,
  formatAssetMoneyInput,
  getLocalAssetData,
  makeLocalAssetTransaction,
  recordLocalGoldSale,
  recordLocalSavingsMovement,
  savingsAccountInputSchema,
  savingsInterestMethods,
  savingsMovementInputSchema,
  upsertLocalGoldAsset,
  upsertLocalSavingsAccount,
  archiveLocalGoldAsset,
  archiveLocalSavingsAccount,
  deleteLocalGoldAsset,
  deleteLocalSavingsAccount,
  isLocalAssetTransaction,
  setLocalGoldBuybackPrice,
  sanitizeDecimalInput,
  type GoldAsset,
  type SavingsAccount,
  type SavingsAccountInput,
  type SavingsMovementInput,
  type SavingsMovementType,
} from '../lib/assets';
import { isSupabaseConfigured } from '../lib/supabase';
import { userFacingError } from '../lib/errorRecovery';
import { reportClientError } from '../lib/telemetry';

type SavingsForm = {
  id?: string;
  bankName: string;
  name: string;
  principal: string;
  annualInterestRate: string;
  termMonths: string;
  openedOn: string;
  maturityOn: string;
  interestMethod: SavingsAccountInput['interestMethod'];
  paymentMethodId: string;
  note: string;
  createTransaction: boolean;
};

type GoldForm = {
  id?: string;
  purchaseDate: string;
  quantityChi: string;
  purchasePricePerChi: string;
  paymentMethodId: string;
  note: string;
  createTransaction: boolean;
};

type MovementForm = {
  accountId: string;
  type: SavingsMovementInput['type'];
  amount: string;
  movementDate: string;
  paymentMethodId: string;
  note: string;
};

type SaleForm = {
  assetId: string;
  saleDate: string;
  quantityChi: string;
  salePricePerChi: string;
  paymentMethodId: string;
  note: string;
};

const newLocalId = (prefix: string) =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `local-${prefix}-${Date.now()}`;

const todayInVietnam = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const inputAmount = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const inputDecimal = sanitizeDecimalInput;
const formatQuantity = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
const formatRate = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 4 });
const calculatedMaturityDate = (openedOn: string, termMonths: string) => {
  const months = Number(inputAmount(termMonths));
  return calculateSavingsMaturityDate(openedOn, months);
};
const goldUnitLabel = (en: boolean) => (en ? 'mace' : 'chỉ');

const interestMethodLabel = (value: SavingsAccount['interestMethod'], en: boolean) => {
  if (value === 'monthly') return en ? 'Monthly' : 'Hàng tháng';
  if (value === 'upfront') return en ? 'Upfront' : 'Đầu kỳ';
  if (value === 'renew') return en ? 'Renew principal' : 'Tái tục';
  return en ? 'At maturity' : 'Cuối kỳ';
};

const movementLabel = (value: SavingsMovementType, en: boolean) => {
  if (value === 'interest') return en ? 'Interest received' : 'Ghi lãi';
  if (value === 'withdrawal') return en ? 'Withdrawal' : 'Rút tiền';
  if (value === 'fee') return en ? 'Fee' : 'Phí';
  if (value === 'settlement') return en ? 'Settlement' : 'Tất toán';
  return en ? 'Opening deposit' : 'Mở sổ';
};

const savingsMovementAutomationKey = (value: SavingsMovementType): AutomaticTransactionKey => {
  if (value === 'interest') return 'savings_interest';
  if (value === 'withdrawal') return 'savings_withdrawal';
  if (value === 'fee') return 'savings_fee';
  if (value === 'settlement') return 'savings_settlement';
  return 'savings_opening';
};

function assetError(error: unknown, en: boolean, fallback: string) {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';
  if (raw.includes('forbidden') || raw.includes('42501'))
    return en ? 'You must be a family member to change assets.' : 'Bạn phải là thành viên gia đình để thay đổi tài sản.';
  if (raw.includes('insufficient_balance'))
    return en ? 'The amount is greater than the current savings balance.' : 'Số tiền vượt quá số dư hiện tại của sổ.';
  if (raw.includes('insufficient_quantity'))
    return en ? 'The quantity is greater than the remaining gold.' : 'Số lượng vượt quá số vàng còn lại.';
  if (raw.includes('settlement_must_match_balance'))
    return en ? 'Settlement amount must equal the current savings balance.' : 'Số tiền tất toán phải bằng đúng số dư hiện tại của sổ.';
  if (raw.includes('asset_has_sales'))
    return en ? 'Purchase quantity and cost cannot change after a partial sale.' : 'Không thể đổi số lượng hoặc giá vốn sau khi đã bán một phần.';
  if (raw.includes('account_not_closed'))
    return en ? 'Close the savings book with a settlement before archiving it.' : 'Hãy tất toán sổ trước khi lưu trữ.';
  if (raw.includes('asset_not_sold'))
    return en ? 'Sell all remaining gold before archiving it.' : 'Hãy bán hết vàng còn lại trước khi lưu trữ.';
  if (raw.includes('principal_edit_not_allowed'))
    return en ? 'The opening principal cannot be edited after the book is created.' : 'Không thể sửa tiền gốc sau khi đã tạo sổ.';
  if (raw.includes('catalog_not_ready'))
    return en ? 'The asset categories are not ready yet. Please reload and try again.' : 'Danh mục tài sản chưa sẵn sàng. Hãy tải lại trang rồi thử lại.';
  if (raw.includes('account_not_active') || raw.includes('asset_not_active'))
    return en ? 'This asset is no longer active.' : 'Tài sản này không còn ở trạng thái hoạt động.';
  if (raw.includes('catalog_not_ready'))
    return en ? 'The family is missing a category needed to record the gold transaction. Please refresh after the update.' : 'Gia đình đang thiếu danh mục cần thiết để ghi giao dịch mua vàng. Vui lòng tải lại sau khi cập nhật hệ thống.';
  return en ? fallback : userFacingError(error, fallback);
}

function paymentName(paymentMethodId: string, paymentMethods: ReturnType<typeof useApp>['paymentMethods'], language: 'vi' | 'en') {
  return getCatalogDisplayName(paymentMethods.find((item) => item.id === paymentMethodId), language) || '—';
}

export function Assets() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const {
    familyId,
    currentUserId,
    currentUserRole,
    purposes,
    expenseTypes,
    paymentMethods,
    transactions,
    setTransactions,
    online,
  } = useApp();
  const { askConfirm, notify } = useFeedback();
  const queryClient = useQueryClient();
  const canManage = canManageAssets(currentUserRole);
  const [savingsEditor, setSavingsEditorState] = useState<SavingsForm | null>(null);
  const [goldEditor, setGoldEditorState] = useState<GoldForm | null>(null);
  const [movementEditor, setMovementEditorState] = useState<MovementForm | null>(null);
  const [saleEditor, setSaleEditorState] = useState<SaleForm | null>(null);
  const [goldBuybackPriceInput, setGoldBuybackPriceInput] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState('');

  const setSavingsEditor = (value: SavingsForm | null) =>
    setSavingsEditorState(value ? {
      ...value,
      principal: formatAssetMoneyInput(value.principal),
      maturityOn: calculatedMaturityDate(value.openedOn, value.termMonths),
    } : null);
  const setGoldEditor = (value: GoldForm | null) =>
    setGoldEditorState(value ? {
      ...value,
      purchasePricePerChi: formatAssetMoneyInput(value.purchasePricePerChi),
    } : null);
  const setMovementEditor = (value: MovementForm | null) =>
    setMovementEditorState(value ? { ...value, amount: formatAssetMoneyInput(value.amount) } : null);
  const setSaleEditor = (value: SaleForm | null) =>
    setSaleEditorState(value ? { ...value, salePricePerChi: formatAssetMoneyInput(value.salePricePerChi) } : null);

  const assetQuery = useQuery({
    queryKey: ['assets', familyId],
    queryFn: () => fetchAssetData(familyId),
    enabled: isSupabaseConfigured && Boolean(familyId),
    retry: false,
    staleTime: 30_000,
  });
  const assetSummaryQuery = useQuery({
    queryKey: ['asset-summary', familyId],
    queryFn: () => fetchAssetSummary(familyId),
    enabled: isSupabaseConfigured && Boolean(familyId),
    retry: false,
    staleTime: 30_000,
  });
  const catalogs = useMemo(() => ({ purposes, expenseTypes, paymentMethods }), [expenseTypes, paymentMethods, purposes]);
  const systemAutomaticDefaults = useMemo(() => createSystemAutomaticTransactionDefaults(catalogs), [catalogs]);
  const automaticDefaultsQuery = useQuery({
    queryKey: ['automatic-transaction-defaults', familyId],
    queryFn: () => fetchAutomaticTransactionDefaults(familyId),
    enabled: Boolean(familyId),
    retry: false,
    staleTime: 30_000,
  });
  const automaticDefaults = useMemo(
    () => automaticDefaultsQuery.data?.length
      ? sanitizeAutomaticTransactionDefaults(automaticDefaultsQuery.data, catalogs)
      : systemAutomaticDefaults,
    [automaticDefaultsQuery.data, catalogs, systemAutomaticDefaults],
  );
  const automaticDefault = (automationKey: AutomaticTransactionKey) =>
    automaticDefaults.find((item) => item.automationKey === automationKey)
    || systemAutomaticDefaults.find((item) => item.automationKey === automationKey)
    || { automationKey, purposeId: '', expenseTypeId: '', paymentMethodId: '' };
  const data = isSupabaseConfigured
    ? assetQuery.data
    : getLocalAssetData(familyId);
  const goldBuybackPricePerChi = data?.goldBuybackPricePerChi;

  useEffect(() => {
    if (goldBuybackPricePerChi === undefined) return;
    setGoldBuybackPriceInput(goldBuybackPricePerChi === null ? '' : formatAssetMoneyInput(goldBuybackPricePerChi));
  }, [goldBuybackPricePerChi]);

  const activeSavings = (data?.savingsAccounts || []).filter((item) => item.status !== 'archived');
  const activeGold = (data?.goldAssets || []).filter((item) => item.status === 'active');
  const soldGold = (data?.goldAssets || []).filter((item) => item.status === 'sold');
  const archivedSavings = (data?.savingsAccounts || []).filter((item) => item.status === 'archived');
  const archivedGold = (data?.goldAssets || []).filter((item) => item.status === 'archived');
  const maturityAlerts = activeSavings.filter((item) => item.status === 'active' && daysUntilMaturity(item.maturityOn) <= 30);
  const overdueSavingsCount = maturityAlerts.filter((item) => daysUntilMaturity(item.maturityOn) < 0).length;
  const dueSoonSavingsCount = maturityAlerts.length - overdueSavingsCount;
  const savingsTotal = activeSavings.reduce((total, item) => total + item.currentBalance, 0);
  const goldQuantity = activeGold.reduce((total, item) => total + item.remainingQuantityChi, 0);
  const goldValue = activeGold.reduce((total, item) => total + goldEstimatedValue(item), 0);
  const localSummary = useMemo(
    () => buildLocalAssetSummary(familyId, transactions),
    [familyId, transactions],
  );
  const summary = isSupabaseConfigured ? assetSummaryQuery.data : localSummary;

  const refreshRelated = async () => {
    if (!isSupabaseConfigured) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['assets', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['asset-summary', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['transaction-years', familyId] }),
    ]);
  };

  const saveGoldBuybackPrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawPrice = inputAmount(goldBuybackPriceInput);
    const parsed = goldBuybackPriceInputSchema.safeParse(rawPrice ? Number(rawPrice) : null);
    if (!parsed.success) {
      setFormError(en ? 'Enter a valid positive shop buy-back price.' : 'Hãy nhập giá tiệm mua vào hợp lệ, lớn hơn 0.');
      return;
    }
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before saving.' : 'Hãy kết nối lại trước khi lưu.');
      return;
    }
    setBusy('gold-price');
    setFormError('');
    try {
      if (isSupabaseConfigured) await setGoldBuybackPrice(familyId, parsed.data);
      else setLocalGoldBuybackPrice(familyId, parsed.data);
      setGoldBuybackPriceInput(parsed.data === null ? '' : formatAssetMoneyInput(parsed.data));
      await refreshRelated();
      notify(en ? 'Shared gold buy-back price saved.' : 'Đã lưu giá tiệm mua vào dùng chung.');
    } catch (error) {
      reportClientError(error, 'mutation');
      setFormError(assetError(error, en, en ? 'Could not save the shared gold price.' : 'Không thể lưu giá vàng dùng chung.'));
    } finally {
      setBusy('');
    }
  };

  const closeEditors = () => {
    setSavingsEditor(null);
    setGoldEditor(null);
    setMovementEditor(null);
    setSaleEditor(null);
    setFormError('');
  };

  const openSavingsEditor = (item?: SavingsAccount) => {
    const today = todayInVietnam();
    setFormError('');
    setSavingsEditor(item
      ? {
          id: item.id,
          bankName: item.bankName,
          name: item.name,
          principal: formatAssetMoneyInput(item.principal),
          annualInterestRate: String(item.annualInterestRate),
          termMonths: String(item.termMonths),
          openedOn: item.openedOn,
          maturityOn: calculatedMaturityDate(item.openedOn, String(item.termMonths)),
          interestMethod: item.interestMethod,
          paymentMethodId: automaticDefault('savings_opening').paymentMethodId,
          note: item.note || '',
          createTransaction: false,
        }
      : {
          bankName: '',
          name: '',
          principal: '',
          annualInterestRate: '',
          termMonths: '6',
          openedOn: today,
          maturityOn: calculateSavingsMaturityDate(today, 6),
          interestMethod: 'end_of_term',
          paymentMethodId: automaticDefault('savings_opening').paymentMethodId,
          note: '',
          createTransaction: true,
        });
  };

  const openGoldEditor = (item?: GoldAsset) => {
    setFormError('');
    setGoldEditor(item
      ? {
          id: item.id,
          purchaseDate: item.purchaseDate,
          quantityChi: String(item.quantityChi),
          purchasePricePerChi: formatAssetMoneyInput(item.purchasePricePerChi),
          paymentMethodId: automaticDefault('gold_purchase').paymentMethodId,
          note: item.note || '',
          createTransaction: false,
        }
      : {
          purchaseDate: todayInVietnam(),
          quantityChi: '',
          purchasePricePerChi: '',
          paymentMethodId: automaticDefault('gold_purchase').paymentMethodId,
          note: '',
          createTransaction: true,
        });
  };

  const openMovementEditor = (account: SavingsAccount, type: SavingsMovementInput['type']) => {
    setFormError('');
    setMovementEditor({
      accountId: account.id,
      type,
      amount: type === 'settlement' ? formatAssetMoneyInput(account.currentBalance) : '',
      movementDate: todayInVietnam(),
      paymentMethodId: automaticDefault(savingsMovementAutomationKey(type)).paymentMethodId,
      note: '',
    });
  };

  const openSaleEditor = (asset: GoldAsset) => {
    setFormError('');
    setSaleEditor({
      assetId: asset.id,
      saleDate: todayInVietnam(),
      quantityChi: String(asset.remainingQuantityChi),
      salePricePerChi: asset.estimatedSellPricePerChi === null
        ? formatAssetMoneyInput(asset.purchasePricePerChi)
        : formatAssetMoneyInput(asset.estimatedSellPricePerChi),
      paymentMethodId: automaticDefault('gold_sale').paymentMethodId,
      note: '',
    });
  };

  const saveSavings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!savingsEditor) return;
    const parsed = savingsAccountInputSchema.safeParse({
      bankName: savingsEditor.bankName,
      name: savingsEditor.name,
      principal: Number(inputAmount(savingsEditor.principal)),
      annualInterestRate: inputDecimal(savingsEditor.annualInterestRate) ? Number(inputDecimal(savingsEditor.annualInterestRate)) : Number.NaN,
      termMonths: Number(inputAmount(savingsEditor.termMonths)),
      openedOn: savingsEditor.openedOn,
      maturityOn: savingsEditor.maturityOn,
      interestMethod: savingsEditor.interestMethod,
      paymentMethodId: savingsEditor.paymentMethodId || null,
      note: savingsEditor.note,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || (en ? 'Review the savings form.' : 'Hãy kiểm tra lại biểu mẫu sổ tiết kiệm.'));
      return;
    }
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before saving.' : 'Hãy kết nối lại trước khi lưu.');
      return;
    }
    const isNew = !savingsEditor.id;
    if (isNew && savingsEditor.createTransaction && !await askConfirm({
      title: en ? 'Create the savings book and cash expense?' : 'Tạo sổ và ghi giao dịch chi tiền?',
      description: en ? `A ${formatVnd(parsed.data.principal)} expense will be created for the opening deposit so cash is reduced.` : `Hệ thống sẽ tự tạo giao dịch chi ${formatVnd(parsed.data.principal)} cho khoản mở sổ để trừ tiền ròng.`,
      confirmLabel: en ? 'Create and record' : 'Tạo và ghi giao dịch',
    })) return;
    setBusy('savings-save');
    setFormError('');
    try {
      if (isSupabaseConfigured) {
        await upsertSavingsAccount(familyId, parsed.data, savingsEditor.id, Boolean(savingsEditor.createTransaction));
      } else {
        const accountId = savingsEditor.id || newLocalId('savings');
        const transaction = savingsEditor.createTransaction
          ? makeLocalAssetTransaction({
              familyId,
              currentUserId,
              date: parsed.data.openedOn,
              transactionType: 'Chi tiêu',
              description: `Gửi tiết kiệm: ${parsed.data.bankName} - ${parsed.data.name}`,
              amount: parsed.data.principal,
              purposeId: automaticDefault('savings_opening').purposeId,
              expenseTypeId: automaticDefault('savings_opening').expenseTypeId,
              paymentMethodId: automaticDefault('savings_opening').paymentMethodId,
              sourceReference: `asset:savings:${accountId}:opening`,
            })
          : null;
        upsertLocalSavingsAccount(familyId, parsed.data, accountId, transaction?.id || null);
        if (transaction) setTransactions((items) => [transaction, ...items]);
      }
      await refreshRelated();
      closeEditors();
      notify(en ? 'Savings book saved.' : 'Đã lưu sổ tiết kiệm.');
    } catch (error) {
      reportClientError(error, 'mutation');
      setFormError(assetError(error, en, en ? 'Could not save the savings book.' : 'Không thể lưu sổ tiết kiệm.'));
    } finally {
      setBusy('');
    }
  };

  const saveGold = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!goldEditor) return;
    const parsed = goldAssetInputSchema.safeParse({
      purchaseDate: goldEditor.purchaseDate,
      quantityChi: Number(inputDecimal(goldEditor.quantityChi)),
      purchasePricePerChi: Number(inputAmount(goldEditor.purchasePricePerChi)),
      estimatedSellPricePerChi: null,
      paymentMethodId: goldEditor.paymentMethodId || null,
      note: goldEditor.note,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || (en ? 'Review the gold form.' : 'Hãy kiểm tra lại biểu mẫu vàng.'));
      return;
    }
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before saving.' : 'Hãy kết nối lại trước khi lưu.');
      return;
    }
    const isNew = !goldEditor.id;
    if (isNew && goldEditor.createTransaction && !await askConfirm({
      title: en ? 'Create gold and cash expense?' : 'Tạo vàng và ghi giao dịch chi tiền?',
      description: en ? `A ${formatVnd(goldPurchaseAmount(parsed.data.quantityChi, parsed.data.purchasePricePerChi))} expense will be created for the purchase.` : `Hệ thống sẽ tự tạo giao dịch chi ${formatVnd(goldPurchaseAmount(parsed.data.quantityChi, parsed.data.purchasePricePerChi))} cho khoản mua vàng.`,
      confirmLabel: en ? 'Create and record' : 'Tạo và ghi giao dịch',
    })) return;
    setBusy('gold-save');
    setFormError('');
    try {
      if (isSupabaseConfigured) {
        await upsertGoldAsset(familyId, parsed.data, goldEditor.id, Boolean(goldEditor.createTransaction));
      } else {
        const assetId = goldEditor.id || newLocalId('gold');
        const amount = goldPurchaseAmount(parsed.data.quantityChi, parsed.data.purchasePricePerChi);
        const transaction = goldEditor.createTransaction
          ? makeLocalAssetTransaction({
              familyId,
              currentUserId,
              date: parsed.data.purchaseDate,
              transactionType: 'Chi tiêu',
              description: `Mua vàng: ${formatQuantity(parsed.data.quantityChi)} chỉ`,
              amount,
              purposeId: automaticDefault('gold_purchase').purposeId,
              expenseTypeId: automaticDefault('gold_purchase').expenseTypeId,
              paymentMethodId: automaticDefault('gold_purchase').paymentMethodId,
              sourceReference: `asset:gold:${assetId}:purchase`,
            })
          : null;
        upsertLocalGoldAsset(familyId, parsed.data, assetId, transaction?.id || null);
        if (transaction) setTransactions((items) => [transaction, ...items]);
      }
      await refreshRelated();
      closeEditors();
      notify(en ? 'Gold saved.' : 'Đã lưu vàng.');
    } catch (error) {
      reportClientError(error, 'mutation');
      setFormError(assetError(error, en, en ? 'Could not save gold.' : 'Không thể lưu vàng.'));
    } finally {
      setBusy('');
    }
  };

  const saveMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!movementEditor) return;
    const parsed = savingsMovementInputSchema.safeParse({
      type: movementEditor.type,
      amount: Number(inputAmount(movementEditor.amount)),
      movementDate: movementEditor.movementDate,
      paymentMethodId: movementEditor.paymentMethodId || null,
      note: movementEditor.note,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || (en ? 'Review the movement form.' : 'Hãy kiểm tra lại thông tin phát sinh.'));
      return;
    }
    const account = data?.savingsAccounts.find((item) => item.id === movementEditor.accountId);
    if (!account) return;
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before saving.' : 'Hãy kết nối lại trước khi lưu.');
      return;
    }
    const income = parsed.data.type !== 'fee';
    if (!await askConfirm({
      title: en ? `${movementLabel(parsed.data.type, true)} and create a transaction?` : `${movementLabel(parsed.data.type, false)} và tự tạo giao dịch?`,
      description: income
        ? (en ? `This creates a ${formatVnd(parsed.data.amount)} income transaction.` : `Hệ thống sẽ tạo giao dịch thu nhập ${formatVnd(parsed.data.amount)}.`)
        : (en ? `This creates a ${formatVnd(parsed.data.amount)} expense transaction.` : `Hệ thống sẽ tạo giao dịch chi ${formatVnd(parsed.data.amount)}.`),
      confirmLabel: en ? 'Record' : 'Ghi nhận',
    })) return;
    setBusy('movement');
    setFormError('');
    try {
      if (isSupabaseConfigured) {
        await recordSavingsMovement(familyId, movementEditor.accountId, parsed.data);
      } else {
        const movementId = newLocalId('savings-movement');
        const transaction = makeLocalAssetTransaction({
          familyId,
          currentUserId,
          date: parsed.data.movementDate,
          transactionType: income ? 'Thu nhập' : 'Chi tiêu',
          description: `${movementLabel(parsed.data.type, false)}: ${account.bankName} - ${account.name}`,
          amount: parsed.data.amount,
          purposeId: automaticDefault(savingsMovementAutomationKey(parsed.data.type)).purposeId,
          expenseTypeId: automaticDefault(savingsMovementAutomationKey(parsed.data.type)).expenseTypeId,
          paymentMethodId: automaticDefault(savingsMovementAutomationKey(parsed.data.type)).paymentMethodId,
          sourceReference: `asset:savings:${account.id}:movement:${movementId}`,
        });
        recordLocalSavingsMovement(familyId, account.id, parsed.data, transaction.id, movementId);
        setTransactions((items) => [transaction, ...items]);
      }
      await refreshRelated();
      closeEditors();
      notify(en ? 'Savings movement recorded.' : 'Đã ghi nhận phát sinh sổ tiết kiệm.');
    } catch (error) {
      reportClientError(error, 'mutation');
      setFormError(assetError(error, en, en ? 'Could not record the savings movement.' : 'Không thể ghi nhận phát sinh sổ tiết kiệm.'));
    } finally {
      setBusy('');
    }
  };

  const saveSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!saleEditor) return;
    const parsed = goldSaleInputSchema.safeParse({
      saleDate: saleEditor.saleDate,
      quantityChi: Number(inputDecimal(saleEditor.quantityChi)),
      salePricePerChi: Number(inputAmount(saleEditor.salePricePerChi)),
      paymentMethodId: saleEditor.paymentMethodId || null,
      note: saleEditor.note,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || (en ? 'Review the sale form.' : 'Hãy kiểm tra lại thông tin bán.'));
      return;
    }
    const asset = data?.goldAssets.find((item) => item.id === saleEditor.assetId);
    if (!asset) return;
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before saving.' : 'Hãy kết nối lại trước khi lưu.');
      return;
    }
    const amount = goldPurchaseAmount(parsed.data.quantityChi, parsed.data.salePricePerChi);
    if (!await askConfirm({
      title: en ? 'Sell gold and create income?' : 'Bán vàng và tự tạo giao dịch thu nhập?',
      description: en ? `This records ${formatQuantity(parsed.data.quantityChi)} mace and creates ${formatVnd(amount)} income. No selling fee is included.` : `Hệ thống sẽ ghi bán ${formatQuantity(parsed.data.quantityChi)} chỉ và tạo giao dịch thu nhập ${formatVnd(amount)}. Không tính phí bán.`,
      confirmLabel: en ? 'Sell and record' : 'Bán và ghi nhận',
    })) return;
    setBusy('sale');
    setFormError('');
    try {
      if (isSupabaseConfigured) {
        await recordGoldSale(familyId, saleEditor.assetId, parsed.data);
      } else {
        const saleId = newLocalId('gold-sale');
        const transaction = makeLocalAssetTransaction({
          familyId,
          currentUserId,
          date: parsed.data.saleDate,
          transactionType: 'Thu nhập',
          description: `Bán vàng: ${formatQuantity(parsed.data.quantityChi)} chỉ`,
          amount,
          purposeId: automaticDefault('gold_sale').purposeId,
          expenseTypeId: automaticDefault('gold_sale').expenseTypeId,
          paymentMethodId: automaticDefault('gold_sale').paymentMethodId,
          sourceReference: `asset:gold:${asset.id}:sale:${saleId}`,
        });
        recordLocalGoldSale(familyId, asset.id, parsed.data, transaction.id, saleId);
        setTransactions((items) => [transaction, ...items]);
      }
      await refreshRelated();
      closeEditors();
      notify(en ? 'Gold sale recorded.' : 'Đã ghi nhận bán vàng.');
    } catch (error) {
      reportClientError(error, 'mutation');
      setFormError(assetError(error, en, en ? 'Could not record the gold sale.' : 'Không thể ghi nhận bán vàng.'));
    } finally {
      setBusy('');
    }
  };

  const archiveSavings = async (account: SavingsAccount) => {
    if (!await askConfirm({
      title: en ? 'Archive this savings book?' : 'Lưu trữ sổ tiết kiệm này?',
      description: en ? 'It will be kept in history and removed from the active list.' : 'Sổ vẫn được giữ trong lịch sử nhưng sẽ ẩn khỏi danh sách đang theo dõi.',
      confirmLabel: en ? 'Archive' : 'Lưu trữ',
      danger: true,
    })) return;
    setBusy(account.id);
    try {
      if (isSupabaseConfigured) await archiveSavingsAccount(familyId, account.id);
      else archiveLocalSavingsAccount(familyId, account.id);
      await refreshRelated();
      notify(en ? 'Savings book archived.' : 'Đã lưu trữ sổ tiết kiệm.');
    } catch (error) {
      notify(assetError(error, en, en ? 'Could not archive the savings book.' : 'Không thể lưu trữ sổ tiết kiệm.'), 'error');
    } finally {
      setBusy('');
    }
  };

  const archiveGold = async (asset: GoldAsset) => {
    if (!await askConfirm({
      title: en ? 'Archive this gold?' : 'Lưu trữ vàng này?',
      description: en ? 'It will stay in history and leave the active list.' : 'Vàng vẫn được giữ trong lịch sử và rời khỏi danh sách đang theo dõi.',
      confirmLabel: en ? 'Archive' : 'Lưu trữ',
      danger: true,
    })) return;
    setBusy(asset.id);
    try {
      if (isSupabaseConfigured) await archiveGoldAsset(familyId, asset.id);
      else archiveLocalGoldAsset(familyId, asset.id);
      await refreshRelated();
      notify(en ? 'Gold archived.' : 'Đã lưu trữ vàng.');
    } catch (error) {
      notify(assetError(error, en, en ? 'Could not archive gold.' : 'Không thể lưu trữ vàng.'), 'error');
    } finally {
      setBusy('');
    }
  };

  const deleteSavings = async (account: SavingsAccount) => {
    if (!await askConfirm({
      title: en ? 'Delete this savings book permanently?' : 'Xóa vĩnh viễn sổ tiết kiệm này?',
      description: en
        ? 'The book, its movement history and every transaction created for it will be permanently deleted.'
        : 'Sổ, toàn bộ lịch sử phát sinh và các giao dịch được tự tạo cho sổ này sẽ bị xóa vĩnh viễn.',
      confirmLabel: en ? 'Delete savings book' : 'Xóa sổ',
      danger: true,
    })) return;
    if (isSupabaseConfigured && !online) {
      notify(en ? 'Reconnect before deleting.' : 'Hãy kết nối lại trước khi xóa.', 'error');
      return;
    }
    setBusy(account.id);
    try {
      if (isSupabaseConfigured) {
        await deleteSavingsAccount(familyId, account.id);
      } else {
        const linkedTransactionIds = deleteLocalSavingsAccount(familyId, account.id);
        setTransactions((items) => items.filter((item) => !linkedTransactionIds.includes(item.id) && !isLocalAssetTransaction(item, 'savings', account.id)));
      }
      await refreshRelated();
      if (savingsEditor?.id === account.id) closeEditors();
      notify(en ? 'Savings book deleted.' : 'Đã xóa sổ tiết kiệm.');
    } catch (error) {
      reportClientError(error, 'mutation');
      notify(assetError(error, en, en ? 'Could not delete the savings book.' : 'Không thể xóa sổ tiết kiệm.'), 'error');
    } finally {
      setBusy('');
    }
  };

  const deleteGold = async (asset: GoldAsset) => {
    if (!await askConfirm({
      title: en ? 'Delete this gold lot permanently?' : 'Xóa vĩnh viễn lô vàng này?',
      description: en
        ? 'The gold lot, sale history and every transaction created for it will be permanently deleted.'
        : 'Lô vàng, toàn bộ lịch sử bán và các giao dịch được tự tạo cho lô này sẽ bị xóa vĩnh viễn.',
      confirmLabel: en ? 'Delete gold' : 'Xóa vàng',
      danger: true,
    })) return;
    if (isSupabaseConfigured && !online) {
      notify(en ? 'Reconnect before deleting.' : 'Hãy kết nối lại trước khi xóa.', 'error');
      return;
    }
    setBusy(asset.id);
    try {
      if (isSupabaseConfigured) {
        await deleteGoldAsset(familyId, asset.id);
      } else {
        const linkedTransactionIds = deleteLocalGoldAsset(familyId, asset.id);
        setTransactions((items) => items.filter((item) => !linkedTransactionIds.includes(item.id) && !isLocalAssetTransaction(item, 'gold', asset.id)));
      }
      await refreshRelated();
      if (goldEditor?.id === asset.id) closeEditors();
      notify(en ? 'Gold deleted.' : 'Đã xóa vàng.');
    } catch (error) {
      reportClientError(error, 'mutation');
      notify(assetError(error, en, en ? 'Could not delete gold.' : 'Không thể xóa vàng.'), 'error');
    } finally {
      setBusy('');
    }
  };

  if (isSupabaseConfigured && !familyId)
    return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/30 dark:text-red-300">{en ? 'No active family was found. Please reload and try again.' : 'Không tìm thấy gia đình đang hoạt động. Vui lòng tải lại rồi thử lại.'}</p>;
  if (isSupabaseConfigured && assetQuery.isPending)
    return <PageSkeleton label={en ? 'Loading assets…' : 'Đang tải tài sản…'} />;
  if (assetQuery.isError && !data)
    return <div role="alert" className="card border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><p className="font-semibold">{en ? 'Could not load assets.' : 'Không thể tải dữ liệu tài sản.'}</p><button type="button" className="btn-secondary mt-3" onClick={() => void assetQuery.refetch()}>{en ? 'Retry' : 'Thử lại'}</button></div>;

  const allSavingsMovements = data?.savingsMovements || [];
  const allGoldSales = data?.goldSales || [];

  return <div className="space-y-5">
    <header className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="page-kicker"><Coins size={16} aria-hidden="true" />{en ? 'Family balance sheet' : 'Tài sản gia đình'}</p>
        <h2 className="page-title">{en ? 'Assets' : 'Tài sản'}</h2>
        <p className="page-subtitle">{en ? 'Track savings books and physical gold in a simple ledger.' : 'Theo dõi sổ tiết kiệm và vàng theo cách đơn giản.'}</p>
      </div>
      {canManage && <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => openSavingsEditor()}><Plus size={17} aria-hidden="true" />{en ? 'Savings book' : 'Thêm sổ'}</button><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => openGoldEditor()}><Plus size={17} aria-hidden="true" />{en ? 'Gold' : 'Thêm vàng'}</button></div>}
    </header>

    {!canManage && <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200">{en ? 'You have read-only access to family assets.' : 'Bạn đang ở chế độ chỉ xem tài sản gia đình.'}</div>}
    {maturityAlerts.length > 0 && <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200"><Landmark size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{overdueSavingsCount > 0 && dueSoonSavingsCount > 0 ? (en ? `${overdueSavingsCount} savings book(s) are overdue and ${dueSoonSavingsCount} mature within 30 days.` : `${overdueSavingsCount} sổ đã quá hạn và ${dueSoonSavingsCount} sổ sẽ đáo hạn trong 30 ngày.`) : overdueSavingsCount > 0 ? (en ? `${overdueSavingsCount} savings book(s) are overdue.` : `${overdueSavingsCount} sổ tiết kiệm đã quá hạn.`) : (en ? `${dueSoonSavingsCount} savings book(s) mature within 30 days.` : `${dueSoonSavingsCount} sổ tiết kiệm sẽ đáo hạn trong 30 ngày.`)}</span></div>}
    {assetQuery.isError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">{en ? 'The latest asset refresh failed. Showing the last loaded values.' : 'Lần làm mới tài sản vừa thất bại. Đang hiển thị dữ liệu đã tải trước đó.'}<button type="button" className="btn-secondary ml-3 px-3 py-1.5 text-xs" onClick={() => void assetQuery.refetch()}>{en ? 'Retry' : 'Thử lại'}</button></div>}
    {assetSummaryQuery.isError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">{en ? 'The net-cash summary could not be loaded.' : 'Không thể tải tổng hợp tiền ròng.'}<button type="button" className="btn-secondary ml-3 px-3 py-1.5 text-xs" onClick={() => void assetSummaryQuery.refetch()}>{en ? 'Retry' : 'Thử lại'}</button></div>}

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={en ? 'Asset totals' : 'Tổng tài sản'}>
      <AssetKpi label={en ? 'Savings balance' : 'Số dư tiết kiệm'} value={savingsTotal} icon={Landmark} tone="emerald" meta={`${activeSavings.length} ${en ? 'book(s)' : 'sổ'}`} />
      <AssetKpi label={en ? 'Gold estimate' : 'Giá trị vàng ước tính'} value={goldValue} icon={Coins} tone="amber" meta={`${formatQuantity(goldQuantity)} ${goldUnitLabel(en)}`} />
      <AssetKpi label={en ? 'Gold cost' : 'Giá vốn vàng'} value={activeGold.reduce((total, item) => total + goldCostValue(item), 0)} icon={ReceiptText} tone="violet" meta={en ? 'Remaining gold' : 'Phần còn lại'} />
      <AssetKpi label={en ? 'Net cash' : 'Tiền ròng'} value={summary?.netCash || 0} icon={WalletCards} tone="sky" meta={en ? 'Actual transactions' : 'Giao dịch thực tế'} />
    </section>

    {savingsEditor && canManage && <SavingsForm editor={savingsEditor} setEditor={setSavingsEditor} onSubmit={saveSavings} onCancel={closeEditors} paymentMethods={paymentMethods} busy={busy === 'savings-save'} error={formError} en={en} />}

    <section className="card overflow-hidden" aria-labelledby="savings-title">
      <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-white/10">
        <div><h3 id="savings-title" className="flex items-center gap-2 text-lg font-extrabold"><Landmark size={19} aria-hidden="true" />{en ? 'Savings books' : 'Sổ tiết kiệm'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Opening a book can create an expense transaction automatically.' : 'Khi mở sổ, hệ thống có thể tự tạo giao dịch chi để trừ tiền.'}</p></div>
        {canManage && <button type="button" className="btn-secondary inline-flex items-center gap-2 self-start text-sm" onClick={() => openSavingsEditor()}><Plus size={16} aria-hidden="true" />{en ? 'Add book' : 'Thêm sổ'}</button>}
      </div>
      {activeSavings.length ? <div className="divide-y divide-black/10 dark:divide-white/10">{activeSavings.map((account) => <SavingsRow key={account.id} account={account} movements={allSavingsMovements.filter((item) => item.savingsAccountId === account.id)} paymentMethods={paymentMethods} canManage={canManage} busy={busy} en={en} language={language} onEdit={() => openSavingsEditor(account)} onAction={(type) => openMovementEditor(account, type)} onArchive={() => void archiveSavings(account)} onDelete={() => void deleteSavings(account)} />)}</div> : <EmptyState title={en ? 'No savings books yet' : 'Chưa có sổ tiết kiệm'} description={en ? 'Add a book to start tracking principal, maturity and actual interest.' : 'Thêm một sổ để theo dõi tiền gốc, đáo hạn và lãi thực tế.'} action={canManage ? <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => openSavingsEditor()}><Plus size={16} aria-hidden="true" />{en ? 'Add savings book' : 'Thêm sổ tiết kiệm'}</button> : undefined} />}
    </section>

    {movementEditor && canManage && <SavingsMovementForm editor={movementEditor} setEditor={setMovementEditor} onSubmit={saveMovement} onCancel={closeEditors} paymentMethods={paymentMethods} busy={busy === 'movement'} error={formError} en={en} account={data?.savingsAccounts.find((item) => item.id === movementEditor.accountId)} />}

    {goldEditor && canManage && <GoldForm editor={goldEditor} setEditor={setGoldEditor} onSubmit={saveGold} onCancel={closeEditors} paymentMethods={paymentMethods} busy={busy === 'gold-save'} error={formError} en={en} hasSales={Boolean(allGoldSales.find((item) => item.goldAssetId === goldEditor.id))} />}

    <section className="card overflow-hidden" aria-labelledby="gold-title">
      <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-white/10">
        <div><h3 id="gold-title" className="flex items-center gap-2 text-lg font-extrabold"><Coins size={19} aria-hidden="true" />{en ? 'Gold' : 'Vàng'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Prices are per mace. Estimate uses the shared shop buy-back price; no selling fee is included.' : 'Giá tính theo chỉ. Giá trị ước tính dùng giá tiệm mua vào dùng chung; không tính phí bán.'}</p></div>
        {canManage && <button type="button" className="btn-secondary inline-flex items-center gap-2 self-start text-sm" onClick={() => openGoldEditor()}><Plus size={16} aria-hidden="true" />{en ? 'Add gold' : 'Thêm vàng'}</button>}
      </div>
      <div className="border-b border-black/10 p-4 dark:border-white/10 sm:p-5">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" onSubmit={saveGoldBuybackPrice}>
          <label className="block min-w-0">
            <span className="label">{en ? 'Shared shop buy-back price / mace (VND)' : 'Giá tiệm mua vào dùng chung / chỉ (VND)'}</span>
            <input className="field" inputMode="numeric" value={goldBuybackPriceInput} disabled={!canManage || busy === 'gold-price'} onChange={(event) => setGoldBuybackPriceInput(formatAssetMoneyInput(event.target.value))} placeholder={en ? 'Optional' : 'Không bắt buộc'} />
            <span className="mt-1 block text-xs text-gray-500">{en ? 'Used for all gold and estimated P/L. Leave empty to hide the estimate.' : 'Áp dụng cho tất cả vàng và lãi/lỗ tạm tính. Để trống nếu chưa muốn tính.'}</span>
          </label>
          {canManage && <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:mt-6 sm:w-auto" disabled={Boolean(busy)}>{busy === 'gold-price' && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{en ? 'Save shared price' : 'Lưu giá dùng chung'}</button>}
        </form>
        {formError && <div role="alert" className="inline-feedback inline-feedback-error mt-3">{formError}</div>}
      </div>
      {activeGold.length ? <div className="divide-y divide-black/10 dark:divide-white/10">{activeGold.map((asset) => <GoldRow key={asset.id} asset={asset} sales={allGoldSales.filter((item) => item.goldAssetId === asset.id)} canManage={canManage} busy={busy} en={en} onEdit={() => openGoldEditor(asset)} onSell={() => openSaleEditor(asset)} onDelete={() => void deleteGold(asset)} />)}</div> : <EmptyState title={en ? 'No gold yet' : 'Chưa có vàng'} description={en ? 'Add each purchase separately so purchase date and cost stay clear.' : 'Mỗi lần mua được lưu riêng để rõ ngày mua và giá vốn.'} action={canManage ? <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => openGoldEditor()}><Plus size={16} aria-hidden="true" />{en ? 'Add gold' : 'Thêm vàng'}</button> : undefined} />}
      {soldGold.length > 0 && <details className="border-t border-black/10 dark:border-white/10"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 font-bold [&::-webkit-details-marker]:hidden"><span>{en ? 'Sold gold' : 'Vàng đã bán'} ({soldGold.length})</span><ChevronDown size={18} aria-hidden="true" /></summary><div className="divide-y divide-black/10 dark:divide-white/10">{soldGold.map((asset) => <GoldRow key={asset.id} asset={asset} sales={allGoldSales.filter((item) => item.goldAssetId === asset.id)} canManage={canManage} busy={busy} en={en} onEdit={() => undefined} onSell={() => undefined} onArchive={() => void archiveGold(asset)} onDelete={() => void deleteGold(asset)} sold />)}</div></details>}
      {archivedGold.length > 0 && <details className="border-t border-black/10 dark:border-white/10"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-bold [&::-webkit-details-marker]:hidden"><span>{en ? 'Archived gold' : 'Vàng đã lưu trữ'} ({archivedGold.length})</span><ChevronDown size={18} aria-hidden="true" /></summary><div className="divide-y divide-black/10 dark:divide-white/10">{archivedGold.map((asset) => <GoldRow key={asset.id} asset={asset} sales={allGoldSales.filter((item) => item.goldAssetId === asset.id)} canManage={canManage} busy={busy} en={en} onEdit={() => undefined} onSell={() => undefined} onDelete={() => void deleteGold(asset)} sold />)}</div></details>}
    </section>

    {saleEditor && canManage && <GoldSaleForm editor={saleEditor} setEditor={setSaleEditor} onSubmit={saveSale} onCancel={closeEditors} paymentMethods={paymentMethods} busy={busy === 'sale'} error={formError} en={en} asset={data?.goldAssets.find((item) => item.id === saleEditor.assetId)} />}
    {archivedSavings.length > 0 && <details className="card overflow-hidden"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 font-bold [&::-webkit-details-marker]:hidden"><span>{en ? 'Archived savings books' : 'Sổ tiết kiệm đã lưu trữ'} ({archivedSavings.length})</span><ChevronDown size={18} aria-hidden="true" /><span className="sr-only">{en ? 'Open archived savings books' : 'Mở sổ tiết kiệm đã lưu trữ'}</span></summary><div className="divide-y divide-black/10 dark:divide-white/10">{archivedSavings.map((account) => <SavingsRow key={account.id} account={account} movements={allSavingsMovements.filter((item) => item.savingsAccountId === account.id)} paymentMethods={paymentMethods} canManage={canManage} busy={busy} en={en} language={language} onEdit={() => undefined} onAction={() => undefined} onArchive={() => undefined} onDelete={() => void deleteSavings(account)} archived />)}</div></details>}
  </div>;
}

function AssetKpi({ label, value, icon: Icon, tone, meta }: { label: string; value: number; icon: typeof Landmark; tone: 'emerald' | 'amber' | 'violet' | 'sky'; meta: string }) {
  return <div className="card min-w-0 p-3 sm:p-4"><div className="flex items-center gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-xl kpi-tone-${tone}`}><Icon size={18} aria-hidden="true" /></span><p className="min-w-0 truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p></div><p className="mt-2 break-words text-lg font-extrabold leading-tight sm:text-xl">{formatVnd(value)}</p><p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">{meta}</p></div>;
}

function SavingsRow({
  account,
  movements,
  paymentMethods,
  canManage,
  busy,
  en,
  language,
  onEdit,
  onAction,
  onArchive,
  onDelete,
  archived = false,
}: {
  account: SavingsAccount;
  movements: ReturnType<typeof getLocalAssetData>['savingsMovements'];
  paymentMethods: ReturnType<typeof useApp>['paymentMethods'];
  canManage: boolean;
  busy: string;
  en: boolean;
  language: 'vi' | 'en';
  onEdit: () => void;
  onAction: (type: SavingsMovementInput['type']) => void;
  onArchive: () => void;
  onDelete: () => void;
  archived?: boolean;
}) {
  const days = daysUntilMaturity(account.maturityOn);
  const expectedInterestToDate = expectedSavingsInterestToDate(account);
  const expectedInterestFullTerm = expectedSavingsInterest(account);
  const maturityClass = days <= 30 && days >= 0 ? 'text-amber-700 dark:text-amber-300' : days < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300';
  const status = account.status === 'closed'
    ? (en ? 'Closed' : 'Đã đóng')
    : account.status === 'archived'
      ? (en ? 'Archived' : 'Đã lưu trữ')
      : (en ? 'Active' : 'Đang hoạt động');
  return <article className="p-4 sm:p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-base font-bold">{account.bankName} · {account.name}</h4><span className="ui-chip">{status}</span></div><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Principal' : 'Tiền gốc'} {formatVnd(account.principal)} · {formatRate(account.annualInterestRate)}% · {account.termMonths} {en ? 'mo.' : 'tháng'} · {interestMethodLabel(account.interestMethod, en)}</p></div>
      <div className="text-left lg:text-right"><p className="text-lg font-extrabold text-[var(--primary)]">{formatVnd(account.currentBalance)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{en ? 'Current balance' : 'Số dư hiện tại'}</p></div>
    </div>
    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-black/[.025] p-3 dark:bg-white/[.04]"><p className="text-xs text-gray-500">{en ? 'Opened' : 'Ngày mở'}</p><p className="mt-1 font-semibold">{formatDateOnlyVi(account.openedOn)}</p></div><div className={`rounded-xl bg-black/[.025] p-3 dark:bg-white/[.04] ${maturityClass}`}><p className="text-xs">{en ? 'Maturity' : 'Đáo hạn'}</p><p className="mt-1 font-semibold">{formatDateOnlyVi(account.maturityOn)}</p><p className="text-xs">{days < 0 ? (en ? 'Past due' : 'Đã quá hạn') : days === 0 ? (en ? 'Today' : 'Hôm nay') : (en ? `${days} day(s) left` : `Còn ${days} ngày`)}</p></div><div className="rounded-xl bg-black/[.025] p-3 dark:bg-white/[.04]"><p className="text-xs text-gray-500">{en ? 'Interest to date' : 'Lãi đến hiện tại'}</p><p className="mt-1 font-semibold">{formatVnd(expectedInterestToDate)}</p><p className="text-xs text-gray-500">{en ? 'estimated through today' : 'ước tính đến hôm nay'}</p></div><div className="rounded-xl bg-black/[.025] p-3 dark:bg-white/[.04]"><p className="text-xs text-gray-500">{en ? 'Full-term interest' : 'Lãi dự kiến toàn kỳ'}</p><p className="mt-1 font-semibold">{formatVnd(expectedInterestFullTerm)}</p><p className="text-xs text-gray-500">{en ? 'if held until maturity' : 'nếu giữ đến đáo hạn'}</p></div></div>
    {account.note && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{account.note}</p>}
    {movements.length > 0 && <details className="mt-3 rounded-xl border border-black/10 dark:border-white/10"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"><span>{en ? 'Book history' : 'Lịch sử sổ'} ({movements.length})</span><ChevronDown size={17} aria-hidden="true" /></summary><div className="divide-y divide-black/10 border-t border-black/10 text-sm dark:divide-white/10 dark:border-white/10">{movements.map((movement) => <div key={movement.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span>{movementLabel(movement.movementType, en)} · {formatDateOnlyVi(movement.movementDate)}<span className="ml-2 text-xs text-gray-500">{paymentName(movement.paymentMethodId || '', paymentMethods, language)}</span></span><span className={movement.movementType === 'fee' ? 'font-semibold text-rose-700 dark:text-rose-300' : 'font-semibold text-emerald-700 dark:text-emerald-300'}>{movement.movementType === 'fee' ? '-' : '+'}{formatVnd(movement.amount)}</span></div>)}</div></details>}
    {canManage && !archived && account.status === 'active' && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" disabled={Boolean(busy)} onClick={onEdit}><Pencil size={15} aria-hidden="true" />{en ? 'Edit' : 'Sửa'}</button><button type="button" className="btn-secondary text-sm" disabled={Boolean(busy)} onClick={() => onAction('interest')}>{en ? 'Record interest' : 'Ghi lãi'}</button><button type="button" className="btn-secondary text-sm" disabled={Boolean(busy)} onClick={() => onAction('withdrawal')}>{en ? 'Withdraw' : 'Rút tiền'}</button><button type="button" className="btn-secondary text-sm" disabled={Boolean(busy)} onClick={() => onAction('fee')}>{en ? 'Fee' : 'Phí'}</button><button type="button" className="btn-primary text-sm" disabled={Boolean(busy) || account.currentBalance <= 0} onClick={() => onAction('settlement')}>{en ? 'Settle' : 'Tất toán'}</button><button type="button" className="danger-button inline-flex items-center gap-2 px-3 text-sm" disabled={Boolean(busy)} onClick={onDelete}>{busy === account.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}{en ? 'Delete' : 'Xóa'}</button></div>}
    {canManage && !archived && account.status === 'closed' && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" disabled={Boolean(busy)} onClick={onArchive}><Archive size={15} aria-hidden="true" />{en ? 'Archive' : 'Lưu trữ'}</button><button type="button" className="danger-button inline-flex items-center gap-2 px-3 text-sm" disabled={Boolean(busy)} onClick={onDelete}>{busy === account.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}{en ? 'Delete' : 'Xóa'}</button></div>}
    {canManage && archived && <button type="button" className="danger-button mt-4 inline-flex items-center gap-2 px-3 text-sm" disabled={Boolean(busy)} onClick={onDelete}>{busy === account.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}{en ? 'Delete permanently' : 'Xóa vĩnh viễn'}</button>}
  </article>;
}

function GoldRow({
  asset,
  sales,
  canManage,
  busy,
  en,
  onEdit,
  onSell,
  onArchive,
  onDelete,
  sold = false,
}: {
  asset: GoldAsset;
  sales: ReturnType<typeof getLocalAssetData>['goldSales'];
  canManage: boolean;
  busy: string;
  en: boolean;
  onEdit: () => void;
  onSell: () => void;
  onArchive?: () => void;
  onDelete: () => void;
  sold?: boolean;
}) {
  const currentValue = goldEstimatedValue(asset);
  const cost = goldCostValue(asset);
  const hasEstimate = asset.estimatedSellPricePerChi !== null;
  const pnl = currentValue - cost;
  const unit = goldUnitLabel(en);
  return <article className="p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-base font-bold">{formatQuantity(asset.remainingQuantityChi)} / {formatQuantity(asset.quantityChi)} {unit}</h4><span className="ui-chip">{sold || asset.status === 'archived' ? (en ? 'Sold' : 'Đã bán') : (en ? 'Active' : 'Đang giữ')}</span></div><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Purchased' : 'Ngày mua'} {formatDateOnlyVi(asset.purchaseDate)} · {en ? 'Cost' : 'Giá mua'} {formatVnd(asset.purchasePricePerChi)}/{unit}</p></div><div className="text-left lg:text-right"><p className="text-lg font-extrabold text-[var(--primary)]">{hasEstimate ? formatVnd(currentValue) : '—'}</p><p className="text-xs text-gray-500 dark:text-gray-400">{en ? 'Estimated sell value' : 'Giá trị bán ước tính'}</p></div></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div className="rounded-xl bg-black/[.025] p-3 dark:bg-white/[.04]"><p className="text-xs text-gray-500">{en ? 'Purchase price' : 'Giá mua'}</p><p className="mt-1 font-semibold">{formatVnd(asset.purchasePricePerChi)}/{unit}</p></div><div className="rounded-xl bg-black/[.025] p-3 dark:bg-white/[.04]"><p className="text-xs text-gray-500">{en ? 'Shop buy-back estimate' : 'Giá tiệm mua vào'}</p><p className="mt-1 font-semibold">{asset.estimatedSellPricePerChi === null ? (en ? 'Not entered' : 'Chưa nhập') : `${formatVnd(asset.estimatedSellPricePerChi)}/${unit}`}</p></div><div className={`rounded-xl p-3 ${!hasEstimate ? 'bg-black/[.025] text-gray-500 dark:bg-white/[.04]' : pnl >= 0 ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-200'}`}><p className="text-xs">{en ? 'Estimated P/L' : 'Lãi/lỗ tạm tính'}</p><p className="mt-1 flex items-center gap-1 font-semibold">{!hasEstimate ? '—' : <>{pnl >= 0 ? <TrendingUp size={15} aria-hidden="true" /> : <TrendingDown size={15} aria-hidden="true" />}{pnl >= 0 ? '+' : ''}{formatVnd(pnl)}</>}</p></div></div>{asset.note && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{asset.note}</p>}{sales.length > 0 && <details className="mt-3 rounded-xl border border-black/10 dark:border-white/10"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"><span>{en ? 'Sale history' : 'Lịch sử bán'} ({sales.length})</span><ChevronDown size={17} aria-hidden="true" /></summary><div className="divide-y divide-black/10 border-t border-black/10 text-sm dark:divide-white/10 dark:border-white/10">{sales.map((sale) => <div key={sale.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span>{formatDateOnlyVi(sale.saleDate)} · {formatQuantity(sale.quantityChi)} {unit} · {formatVnd(sale.salePricePerChi)}/{unit}</span><span className="font-semibold text-emerald-700 dark:text-emerald-300">+{formatVnd(sale.amount)}</span></div>)}</div></details>}{canManage && !sold && asset.status === 'active' && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" disabled={Boolean(busy)} onClick={onEdit}><Pencil size={15} aria-hidden="true" />{en ? 'Edit' : 'Sửa'}</button><button type="button" className="btn-primary text-sm" disabled={Boolean(busy)} onClick={onSell}>{en ? 'Sell gold' : 'Bán vàng'}</button><button type="button" className="danger-button inline-flex items-center gap-2 px-3 text-sm" disabled={Boolean(busy)} onClick={onDelete}>{busy === asset.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}{en ? 'Delete' : 'Xóa'}</button></div>}{canManage && sold && asset.status === 'sold' && onArchive && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" disabled={Boolean(busy)} onClick={onArchive}><Archive size={15} aria-hidden="true" />{en ? 'Archive' : 'Lưu trữ'}</button><button type="button" className="danger-button inline-flex items-center gap-2 px-3 text-sm" disabled={Boolean(busy)} onClick={onDelete}>{busy === asset.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}{en ? 'Delete' : 'Xóa'}</button></div>}{canManage && asset.status === 'archived' && <button type="button" className="danger-button mt-4 inline-flex items-center gap-2 px-3 text-sm" disabled={Boolean(busy)} onClick={onDelete}>{busy === asset.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}{en ? 'Delete permanently' : 'Xóa vĩnh viễn'}</button>}</article>;
}

function PaymentSelect({ id, value, onChange, paymentMethods, en, label = 'Phương thức thanh toán' }: { id: string; value: string; onChange: (value: string) => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; en: boolean; label?: string }) {
  return <label><span className="label">{en ? 'Payment method' : label}</span><select id={id} className="field" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{en ? 'Use the default method' : 'Dùng phương thức mặc định'}</option>{paymentMethods.map((item) => <option key={item.id} value={item.id}>{getCatalogDisplayName(item, en ? 'en' : 'vi')}</option>)}</select></label>;
}

function SavingsForm({ editor, setEditor, onSubmit, onCancel, paymentMethods, busy, error, en }: { editor: SavingsForm; setEditor: (value: SavingsForm | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; busy: boolean; error: string; en: boolean }) {
  return (
    <section className="card border-[var(--primary)] p-4 sm:p-5" aria-labelledby="savings-form-title">
      <div className="flex items-start justify-between gap-3">
        <div><p className="page-kicker"><Landmark size={15} aria-hidden="true" />{en ? 'Savings book form' : 'Thông tin sổ tiết kiệm'}</p><h3 id="savings-form-title" className="text-lg font-extrabold">{editor.id ? (en ? 'Edit savings book' : 'Sửa sổ tiết kiệm') : (en ? 'Add savings book' : 'Thêm sổ tiết kiệm')}</h3></div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label={en ? 'Close savings form' : 'Đóng biểu mẫu sổ'}><X size={18} /></button>
      </div>
      <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onSubmit}>
        <label><span className="label">{en ? 'Bank' : 'Ngân hàng'}</span><input className="field" value={editor.bankName} onChange={(event) => setEditor({ ...editor, bankName: event.target.value })} /></label>
        <label><span className="label">{en ? 'Book name' : 'Tên sổ'}</span><input className="field" value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label>
        <label><span className="label">{en ? 'Opening principal (VND)' : 'Tiền gốc (VND)'}</span><input className="field" inputMode="numeric" disabled={Boolean(editor.id)} value={editor.principal} onChange={(event) => setEditor({ ...editor, principal: event.target.value })} /><span className="mt-1 block text-xs text-gray-500">{editor.id ? (en ? 'Opening principal cannot be edited.' : 'Tiền gốc không sửa sau khi tạo.') : (en ? 'This is also the opening cash expense when enabled.' : 'Khoản này cũng là giao dịch chi mở sổ nếu bật bên dưới.')}</span></label>
        <label><span className="label">{en ? 'Annual rate (%)' : 'Lãi suất năm (%)'}</span><input className="field" type="number" inputMode="decimal" min="0" max="100" step="0.0001" value={editor.annualInterestRate} onChange={(event) => setEditor({ ...editor, annualInterestRate: sanitizeDecimalInput(event.target.value) })} /></label>
        <label><span className="label">{en ? 'Term (months)' : 'Kỳ hạn (tháng)'}</span><input className="field" inputMode="numeric" type="number" min="1" max="120" value={editor.termMonths} onChange={(event) => setEditor({ ...editor, termMonths: event.target.value })} /></label>
        <PaymentSelect id="savings-payment" value={editor.paymentMethodId} onChange={(value) => setEditor({ ...editor, paymentMethodId: value })} paymentMethods={paymentMethods} en={en} />
        <label><span className="label">{en ? 'Opened on' : 'Ngày mở'}</span><input className="field" type="date" value={editor.openedOn} onChange={(event) => setEditor({ ...editor, openedOn: event.target.value })} /></label>
        <label><span className="label">{en ? 'Maturity date' : 'Ngày đáo hạn'}</span><input className="field" type="date" value={editor.maturityOn} disabled /><span className="mt-1 block text-xs text-gray-500">{en ? 'Calculated from the opening date and term.' : 'Tự tính từ ngày mở và kỳ hạn.'}</span></label>
        <label><span className="label">{en ? 'Interest payout' : 'Phương thức nhận lãi'}</span><select className="field" value={editor.interestMethod} onChange={(event) => setEditor({ ...editor, interestMethod: event.target.value as SavingsAccountInput['interestMethod'] })}>{savingsInterestMethods.map((method) => <option key={method} value={method}>{interestMethodLabel(method, en)}</option>)}</select></label>
        <label className="sm:col-span-2 lg:col-span-3"><span className="label">{en ? 'Note' : 'Ghi chú'}</span><input className="field" value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} /></label>
        {!editor.id && <label className="flex min-h-11 items-center gap-3 rounded-xl bg-[var(--primary-soft)] px-3 py-2 text-sm sm:col-span-2 lg:col-span-3"><input type="checkbox" checked={editor.createTransaction} onChange={(event) => setEditor({ ...editor, createTransaction: event.target.checked })} /><span>{en ? 'Automatically create the opening expense transaction' : 'Tự tạo giao dịch chi tiền mở sổ'}</span></label>}
        {error && <div role="alert" className="inline-feedback inline-feedback-error sm:col-span-2 lg:col-span-3">{error}</div>}
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-3"><button type="button" className="btn-secondary" onClick={onCancel}>{en ? 'Cancel' : 'Hủy'}</button><button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy}>{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{en ? 'Save savings book' : 'Lưu sổ'}</button></div>
      </form>
    </section>
  );
}

function SavingsMovementForm({ editor, setEditor, onSubmit, onCancel, paymentMethods, busy, error, en, account }: { editor: MovementForm; setEditor: (value: MovementForm | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; busy: boolean; error: string; en: boolean; account?: SavingsAccount }) {
  return <section className="card border-[var(--primary)] p-4 sm:p-5" aria-labelledby="movement-form-title"><div className="flex items-start justify-between gap-3"><div><p className="page-kicker"><ReceiptText size={15} aria-hidden="true" />{en ? 'Savings movement' : 'Phát sinh sổ tiết kiệm'}</p><h3 id="movement-form-title" className="text-lg font-extrabold">{movementLabel(editor.type, en)}{account ? ` · ${account.bankName} - ${account.name}` : ''}</h3></div><button type="button" className="icon-button" onClick={onCancel} aria-label={en ? 'Close movement form' : 'Đóng biểu mẫu phát sinh'}><X size={18} /></button></div><form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}><label><span className="label">{en ? 'Amount (VND)' : 'Số tiền (VND)'}</span><input className="field" inputMode="numeric" value={editor.amount} readOnly={editor.type === 'settlement'} onChange={(event) => setEditor({ ...editor, amount: event.target.value })} /><span className="mt-1 block text-xs text-gray-500">{editor.type === 'interest' ? (en ? 'Interest is recorded as income; the savings balance stays unchanged because it is received in cash.' : 'Lãi được ghi là thu nhập; số dư sổ giữ nguyên vì khoản lãi nhận về tiền.') : editor.type === 'settlement' ? (en ? 'Settlement closes the book and must equal its current balance.' : 'Tất toán đóng sổ và phải bằng đúng số dư hiện tại.') : ''}</span></label><PaymentSelect id="movement-payment" value={editor.paymentMethodId} onChange={(value) => setEditor({ ...editor, paymentMethodId: value })} paymentMethods={paymentMethods} en={en} /><label><span className="label">{en ? 'Date' : 'Ngày'}</span><input className="field" type="date" value={editor.movementDate} onChange={(event) => setEditor({ ...editor, movementDate: event.target.value })} /></label><label><span className="label">{en ? 'Note' : 'Ghi chú'}</span><input className="field" value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} /></label>{error && <div role="alert" className="inline-feedback inline-feedback-error sm:col-span-2">{error}</div>}<div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button type="button" className="btn-secondary" onClick={onCancel}>{en ? 'Cancel' : 'Hủy'}</button><button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy}>{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{en ? 'Record movement' : 'Ghi nhận'}</button></div></form></section>;
}

function GoldForm({ editor, setEditor, onSubmit, onCancel, paymentMethods, busy, error, en, hasSales }: { editor: GoldForm; setEditor: (value: GoldForm | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; busy: boolean; error: string; en: boolean; hasSales: boolean }) {
  return (
    <section className="card border-[var(--primary)] p-4 sm:p-5" aria-labelledby="gold-form-title">
      <div className="flex items-start justify-between gap-3">
        <div><p className="page-kicker"><Coins size={15} aria-hidden="true" />{en ? 'Gold form' : 'Thông tin vàng'}</p><h3 id="gold-form-title" className="text-lg font-extrabold">{editor.id ? (en ? 'Edit gold' : 'Sửa vàng') : (en ? 'Add gold' : 'Thêm vàng')}</h3></div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label={en ? 'Close gold form' : 'Đóng biểu mẫu vàng'}><X size={18} /></button>
      </div>
      <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onSubmit}>
        <label><span className="label">{en ? 'Purchase date' : 'Ngày mua'}</span><input className="field" type="date" value={editor.purchaseDate} onChange={(event) => setEditor({ ...editor, purchaseDate: event.target.value })} /></label>
        <label><span className="label">{en ? 'Quantity (mace)' : 'Số lượng (chỉ)'}</span><input className="field" inputMode="decimal" step="0.001" value={editor.quantityChi} disabled={hasSales} onChange={(event) => setEditor({ ...editor, quantityChi: event.target.value })} /></label>
        <label><span className="label">{en ? 'Purchase price per mace (VND)' : 'Giá mua / chỉ (VND)'}</span><input className="field" inputMode="numeric" value={editor.purchasePricePerChi} disabled={hasSales} onChange={(event) => setEditor({ ...editor, purchasePricePerChi: event.target.value })} /></label>
        <PaymentSelect id="gold-payment" value={editor.paymentMethodId} onChange={(value) => setEditor({ ...editor, paymentMethodId: value })} paymentMethods={paymentMethods} en={en} />
        <label><span className="label">{en ? 'Note' : 'Ghi chú'}</span><input className="field" value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} /></label>
        {!editor.id && <label className="flex min-h-11 items-center gap-3 rounded-xl bg-[var(--primary-soft)] px-3 py-2 text-sm sm:col-span-2 lg:col-span-3"><input type="checkbox" checked={editor.createTransaction} onChange={(event) => setEditor({ ...editor, createTransaction: event.target.checked })} /><span>{en ? 'Automatically create the purchase expense transaction' : 'Tự tạo giao dịch chi tiền mua vàng'}</span></label>}
        {error && <div role="alert" className="inline-feedback inline-feedback-error sm:col-span-2 lg:col-span-3">{error}</div>}
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-3"><button type="button" className="btn-secondary" onClick={onCancel}>{en ? 'Cancel' : 'Hủy'}</button><button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy}>{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{en ? 'Save gold' : 'Lưu vàng'}</button></div>
      </form>
    </section>
  );
}

function GoldSaleForm({ editor, setEditor, onSubmit, onCancel, paymentMethods, busy, error, en, asset }: { editor: SaleForm; setEditor: (value: SaleForm | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; busy: boolean; error: string; en: boolean; asset?: GoldAsset }) {
  const amount = goldPurchaseAmount(Number(inputDecimal(editor.quantityChi)), Number(inputAmount(editor.salePricePerChi)));
  return <section className="card border-[var(--primary)] p-4 sm:p-5" aria-labelledby="gold-sale-form-title"><div className="flex items-start justify-between gap-3"><div><p className="page-kicker"><Banknote size={15} aria-hidden="true" />{en ? 'Gold sale' : 'Bán vàng'}</p><h3 id="gold-sale-form-title" className="text-lg font-extrabold">{asset ? (en ? `${formatQuantity(asset.remainingQuantityChi)} mace remaining` : `${formatQuantity(asset.remainingQuantityChi)} chỉ còn lại`) : (en ? 'Sell gold' : 'Bán vàng')}</h3></div><button type="button" className="icon-button" onClick={onCancel} aria-label={en ? 'Close sale form' : 'Đóng biểu mẫu bán vàng'}><X size={18} /></button></div><form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onSubmit}><label><span className="label">{en ? 'Sale date' : 'Ngày bán'}</span><input className="field" type="date" value={editor.saleDate} onChange={(event) => setEditor({ ...editor, saleDate: event.target.value })} /></label><label><span className="label">{en ? 'Quantity (mace)' : 'Số lượng (chỉ)'}</span><input className="field" inputMode="decimal" step="0.001" value={editor.quantityChi} onChange={(event) => setEditor({ ...editor, quantityChi: event.target.value })} /><span className="mt-1 block text-xs text-gray-500">{asset ? (en ? `Maximum ${formatQuantity(asset.remainingQuantityChi)} mace` : `Tối đa ${formatQuantity(asset.remainingQuantityChi)} chỉ`) : ''}</span></label><label><span className="label">{en ? 'Sale price per mace (VND)' : 'Giá bán / chỉ (VND)'}</span><input className="field" inputMode="numeric" value={editor.salePricePerChi} onChange={(event) => setEditor({ ...editor, salePricePerChi: event.target.value })} /></label><PaymentSelect id="sale-payment" value={editor.paymentMethodId} onChange={(value) => setEditor({ ...editor, paymentMethodId: value })} paymentMethods={paymentMethods} en={en} /><label><span className="label">{en ? 'Note' : 'Ghi chú'}</span><input className="field" value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} /></label><div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200"><p className="text-xs">{en ? 'Income created' : 'Thu nhập sẽ tạo'}</p><p className="mt-1 font-bold">{formatVnd(Number.isFinite(amount) ? amount : 0)}</p><p className="mt-1 text-xs">{en ? 'No selling fee' : 'Không tính phí bán'}</p></div>{error && <div role="alert" className="inline-feedback inline-feedback-error sm:col-span-2 lg:col-span-3">{error}</div>}<div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-3"><button type="button" className="btn-secondary" onClick={onCancel}>{en ? 'Cancel' : 'Hủy'}</button><button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy}>{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{en ? 'Sell and record income' : 'Bán và ghi thu nhập'}</button></div></form></section>;
}

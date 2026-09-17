import {
  Archive,
  Banknote,
  ChevronDown,
  Gem,
  Crown,
  Landmark,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
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
  settleSavingsAccount,
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
  goldEstimatedValue,
  goldPurchaseAmount,
  goldSaleInputSchema,
  goldAssetInputSchema,
  goldBuybackPriceInputSchema,
  formatAssetMoneyInput,
  getLocalAssetData,
  makeLocalAssetTransaction,
  recordLocalGoldSaleAggregate,
  settleLocalSavingsAccount,
  savingsAccountInputSchema,
  savingsInterestMethods,
  savingsSettlementInputSchema,
  upsertLocalGoldAsset,
  upsertLocalSavingsAccount,
  archiveLocalGoldAsset,
  archiveLocalSavingsAccount,
  deleteLocalGoldAsset,
  deleteLocalSavingsAccount,
  isLocalAssetTransaction,
  setLocalGoldBuybackPrice,
  sanitizeDecimalInput,
  summarizeGoldHoldings,
  type GoldAsset,
  type GoldHoldingSummary,
  type SavingsAccount,
  type SavingsAccountInput,
} from '../lib/assets';
import { isSupabaseConfigured } from '../lib/supabase';
import { errorText, userFacingError } from '../lib/errorRecovery';
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

type SettlementForm = {
  accountId: string;
  interestAmount: string;
  settlementDate: string;
  paymentMethodId: string;
  note: string;
};

type SaleForm = {
  saleDate: string;
  quantityChi: string;
  salePricePerChi: string;
  paymentMethodId: string;
  note: string;
};

type AssetTab = 'savings' | 'gold';

const assetTabs: AssetTab[] = ['savings', 'gold'];
const assetTabIds: Record<AssetTab, string> = {
  savings: 'assets-tab-savings',
  gold: 'assets-tab-gold',
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
const formatSignedVnd = (value: number) => `${value > 0 ? '+' : ''}${formatVnd(value)}`;
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

export function assetError(error: unknown, en: boolean, fallback: string) {
  const raw = errorText(error).toLowerCase();
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
    return en
      ? 'The automatic transaction categories are not ready. Uncheck automatic transaction creation to save the asset only, or update the automatic transaction settings and try again.'
      : 'Danh mục giao dịch tự động chưa sẵn sàng. Hãy bỏ chọn tự tạo giao dịch để chỉ lưu tài sản, hoặc cập nhật cài đặt giao dịch tự động rồi thử lại.';
  if (raw.includes('pgrst202') || raw.includes('could not find the function') || raw.includes('upsert_savings_account'))
    return en
      ? 'The savings-book service has not been updated yet. Reload the app and try again.'
      : 'Chức năng lưu sổ chưa được cập nhật. Hãy tải lại ứng dụng rồi thử lại.';
  if (raw.includes('payment_method_not_found'))
    return en ? 'The selected payment method is no longer available. Reload and choose another one.' : 'Phương thức thanh toán đã chọn không còn khả dụng. Hãy tải lại và chọn phương thức khác.';
  if (raw.includes('invalid_'))
    return en ? 'Some savings-book details are invalid. Review the form and try again.' : 'Một số thông tin sổ tiết kiệm không hợp lệ. Hãy kiểm tra lại biểu mẫu rồi thử lại.';
  if (raw.includes('account_not_active') || raw.includes('asset_not_active'))
    return en ? 'This asset is no longer active.' : 'Tài sản này không còn ở trạng thái hoạt động.';
  return en ? fallback : userFacingError(error, fallback);
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
  const [activeTab, setActiveTab] = useState<AssetTab>('savings');
  const [savingsEditor, setSavingsEditorState] = useState<SavingsForm | null>(null);
  const [goldEditor, setGoldEditorState] = useState<GoldForm | null>(null);
  const [settlementEditor, setSettlementEditorState] = useState<SettlementForm | null>(null);
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
  const setSettlementEditor = (value: SettlementForm | null) =>
    setSettlementEditorState(value ? { ...value, interestAmount: formatAssetMoneyInput(value.interestAmount) } : null);
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
  const goldHoldingSummary = summarizeGoldHoldings(activeGold, goldBuybackPricePerChi ?? null);
  const goldQuantity = goldHoldingSummary.quantityChi;
  const goldValue = goldHoldingSummary.estimatedValue ?? 0;
  const localSummary = useMemo(
    () => buildLocalAssetSummary(familyId, transactions),
    [familyId, transactions],
  );
  const summary = isSupabaseConfigured ? assetSummaryQuery.data : localSummary;

  const refreshRelated = async () => {
    if (!isSupabaseConfigured) return;
    const results = await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['assets', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['asset-summary', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['transactions', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['budgets', familyId] }),
      queryClient.invalidateQueries({ queryKey: ['transaction-years', familyId] }),
    ]);
    results.forEach((result) => {
      if (result.status === 'rejected') reportClientError(result.reason, 'query');
    });
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
    setSettlementEditor(null);
    setSaleEditor(null);
    setFormError('');
  };

  const handleAssetTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = assetTabs.indexOf(activeTab);
    const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (currentIndex + 1) % assetTabs.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (currentIndex - 1 + assetTabs.length) % assetTabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? assetTabs.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = assetTabs[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab);
    document.getElementById(assetTabIds[nextTab])?.focus();
  };

  const openSavingsEditor = (item?: SavingsAccount) => {
    setActiveTab('savings');
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
    setActiveTab('gold');
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

  const openSettlementEditor = (account: SavingsAccount) => {
    setActiveTab('savings');
    setFormError('');
    setSettlementEditor({
      accountId: account.id,
      interestAmount: formatAssetMoneyInput(expectedSavingsInterest(account)),
      settlementDate: todayInVietnam(),
      paymentMethodId: automaticDefault('savings_settlement').paymentMethodId,
      note: '',
    });
  };

  const openSaleEditor = () => {
    setActiveTab('gold');
    setFormError('');
    const defaultSalePrice = goldBuybackPricePerChi
      ?? (goldHoldingSummary.averageCostPerChi === null ? '' : Math.round(goldHoldingSummary.averageCostPerChi));
    setSaleEditor({
      saleDate: todayInVietnam(),
      quantityChi: String(goldHoldingSummary.quantityChi),
      salePricePerChi: formatAssetMoneyInput(defaultSalePrice),
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

  const saveSettlement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settlementEditor) return;
    const parsed = savingsSettlementInputSchema.safeParse({
      interestAmount: Number(inputAmount(settlementEditor.interestAmount)),
      settlementDate: settlementEditor.settlementDate,
      paymentMethodId: settlementEditor.paymentMethodId || null,
      note: settlementEditor.note,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || (en ? 'Review the settlement form.' : 'Hãy kiểm tra lại thông tin tất toán.'));
      return;
    }
    const account = data?.savingsAccounts.find((item) => item.id === settlementEditor.accountId);
    if (!account) return;
    if (isSupabaseConfigured && !online) {
      setFormError(en ? 'Reconnect before saving.' : 'Hãy kết nối lại trước khi lưu.');
      return;
    }
    const totalReceived = account.currentBalance + parsed.data.interestAmount;
    if (!await askConfirm({
      title: en ? 'Settle the savings book and record the cash received?' : 'Tất toán sổ và ghi nhận tiền nhận về?',
      description: en
        ? `This closes the book and creates income transactions for ${formatVnd(account.currentBalance)} principal and ${formatVnd(parsed.data.interestAmount)} interest (${formatVnd(totalReceived)} total).`
        : `Hệ thống sẽ đóng sổ và tạo giao dịch thu nhập gồm ${formatVnd(account.currentBalance)} tiền gốc và ${formatVnd(parsed.data.interestAmount)} tiền lãi (${formatVnd(totalReceived)} tổng nhận về).`,
      confirmLabel: en ? 'Settle and record' : 'Tất toán và ghi nhận',
    })) return;
    setBusy('settlement');
    setFormError('');
    try {
      if (isSupabaseConfigured) {
        await settleSavingsAccount(familyId, settlementEditor.accountId, parsed.data);
      } else {
        const settlementMovementId = newLocalId('savings-settlement');
        const settlementTransaction = makeLocalAssetTransaction({
          familyId,
          currentUserId,
          date: parsed.data.settlementDate,
          transactionType: 'Thu nhập',
          description: `Tất toán tiết kiệm: ${account.bankName} - ${account.name}`,
          amount: account.currentBalance,
          purposeId: automaticDefault('savings_settlement').purposeId,
          expenseTypeId: automaticDefault('savings_settlement').expenseTypeId,
          paymentMethodId: automaticDefault('savings_settlement').paymentMethodId,
          sourceReference: `asset:savings:${account.id}:settlement`,
        });
        const interestMovementId = parsed.data.interestAmount > 0 ? newLocalId('savings-settlement-interest') : undefined;
        const interestTransaction = parsed.data.interestAmount > 0
          ? makeLocalAssetTransaction({
              familyId,
              currentUserId,
              date: parsed.data.settlementDate,
              transactionType: 'Thu nhập',
              description: `Lãi tất toán sổ tiết kiệm: ${account.bankName} - ${account.name}`,
              amount: parsed.data.interestAmount,
              purposeId: automaticDefault('savings_interest').purposeId,
              expenseTypeId: automaticDefault('savings_interest').expenseTypeId,
              paymentMethodId: automaticDefault('savings_interest').paymentMethodId,
              sourceReference: `asset:savings:${account.id}:settlement-interest`,
            })
          : null;
        settleLocalSavingsAccount(
          familyId,
          account.id,
          parsed.data,
          settlementTransaction.id,
          interestTransaction?.id || null,
          settlementMovementId,
          interestMovementId,
        );
        setTransactions((items) => [
          ...(interestTransaction ? [interestTransaction] : []),
          settlementTransaction,
          ...items,
        ]);
      }
      await refreshRelated();
      closeEditors();
      notify(en ? 'Savings book settled and cash recorded.' : 'Đã tất toán sổ và ghi nhận tiền gốc, tiền lãi.');
    } catch (error) {
      reportClientError(error, 'mutation');
      setFormError(assetError(error, en, en ? 'Could not settle the savings book.' : 'Không thể tất toán sổ tiết kiệm.'));
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
    if (parsed.data.quantityChi > goldHoldingSummary.quantityChi) {
      setFormError(en ? 'The quantity is greater than the remaining gold.' : 'Số lượng vượt quá số vàng còn lại.');
      return;
    }
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
        await recordGoldSale(familyId, parsed.data);
      } else {
        const saleBatchId = newLocalId('gold-sale');
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
          sourceReference: `asset:gold:aggregate:sale:${saleBatchId}`,
        });
        recordLocalGoldSaleAggregate(familyId, parsed.data, transaction.id);
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
    }
  };

  if (isSupabaseConfigured && !familyId)
    return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/30 dark:text-red-300">{en ? 'No active family was found. Please reload and try again.' : 'Không tìm thấy gia đình đang hoạt động. Vui lòng tải lại rồi thử lại.'}</p>;
  if (isSupabaseConfigured && assetQuery.isPending)
    return <PageSkeleton label={en ? 'Loading assets…' : 'Đang tải tài sản…'} />;
  if (assetQuery.isError && !data)
    return <div role="alert" className="card border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><p className="font-semibold">{en ? 'Could not load assets.' : 'Không thể tải dữ liệu tài sản.'}</p><button type="button" className="btn-secondary mt-3" onClick={() => void assetQuery.refetch()}>{en ? 'Retry' : 'Thử lại'}</button></div>;

  const allGoldSales = data?.goldSales || [];

  return <div className="assets-page space-y-5">
    <header className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="page-kicker"><Gem size={16} aria-hidden="true" />{en ? 'Family balance sheet' : 'Tài sản gia đình'}</p>
        <h2 className="page-title">{en ? 'Assets' : 'Tài sản'}</h2>
        <p className="page-subtitle">{en ? 'Track savings books and physical gold in a simple ledger.' : 'Theo dõi sổ tiết kiệm và vàng theo cách đơn giản.'}</p>
      </div>
      {canManage && <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary asset-add-button asset-add-savings inline-flex items-center gap-2" onClick={() => openSavingsEditor()}><Plus size={17} aria-hidden="true" />{en ? 'Savings book' : 'Thêm sổ'}</button><button type="button" className="btn-secondary asset-add-button asset-add-gold inline-flex items-center gap-2" onClick={() => openGoldEditor()}><Plus size={17} aria-hidden="true" />{en ? 'Gold' : 'Thêm vàng'}</button></div>}
    </header>

    {!canManage && <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200">{en ? 'You have read-only access to family assets.' : 'Bạn đang ở chế độ chỉ xem tài sản gia đình.'}</div>}
    {maturityAlerts.length > 0 && <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200"><Landmark size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{overdueSavingsCount > 0 && dueSoonSavingsCount > 0 ? (en ? `${overdueSavingsCount} savings book(s) are overdue and ${dueSoonSavingsCount} mature within 30 days.` : `${overdueSavingsCount} sổ đã quá hạn và ${dueSoonSavingsCount} sổ sẽ đáo hạn trong 30 ngày.`) : overdueSavingsCount > 0 ? (en ? `${overdueSavingsCount} savings book(s) are overdue.` : `${overdueSavingsCount} sổ tiết kiệm đã quá hạn.`) : (en ? `${dueSoonSavingsCount} savings book(s) mature within 30 days.` : `${dueSoonSavingsCount} sổ tiết kiệm sẽ đáo hạn trong 30 ngày.`)}</span></div>}
    {assetQuery.isError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">{en ? 'The latest asset refresh failed. Showing the last loaded values.' : 'Lần làm mới tài sản vừa thất bại. Đang hiển thị dữ liệu đã tải trước đó.'}<button type="button" className="btn-secondary ml-3 px-3 py-1.5 text-xs" onClick={() => void assetQuery.refetch()}>{en ? 'Retry' : 'Thử lại'}</button></div>}
    {assetSummaryQuery.isError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">{en ? 'The net-cash summary could not be loaded.' : 'Không thể tải tổng hợp tiền ròng.'}<button type="button" className="btn-secondary ml-3 px-3 py-1.5 text-xs" onClick={() => void assetSummaryQuery.refetch()}>{en ? 'Retry' : 'Thử lại'}</button></div>}

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={en ? 'Asset totals' : 'Tổng tài sản'}>
      <AssetKpi label={en ? 'Savings balance' : 'Số dư tiết kiệm'} value={savingsTotal} icon={Landmark} tone="emerald" meta={`${activeSavings.length} ${en ? 'book(s)' : 'sổ'}`} />
      <AssetKpi label={en ? 'Gold estimate' : 'Giá trị vàng ước tính'} value={goldValue} icon={Crown} tone="amber" meta={`${formatQuantity(goldQuantity)} ${goldUnitLabel(en)}`} />
      <AssetKpi label={en ? 'Gold cost' : 'Giá vốn vàng'} value={goldHoldingSummary.cost} icon={ReceiptText} tone="violet" meta={en ? 'Remaining gold' : 'Phần còn lại'} />
      <AssetKpi label={en ? 'Net cash' : 'Tiền ròng'} value={summary?.netCash || 0} icon={WalletCards} tone="sky" meta={en ? 'Actual transactions' : 'Giao dịch thực tế'} />
    </section>

    <div className="card overflow-hidden">
      <div role="tablist" aria-label={en ? 'Asset types' : 'Loại tài sản'} aria-orientation="horizontal" className="grid grid-cols-2 gap-1 p-1.5 sm:p-2">
        <button
          id={assetTabIds.savings}
          type="button"
          role="tab"
          aria-selected={activeTab === 'savings'}
          aria-controls="assets-panel-savings"
          tabIndex={activeTab === 'savings' ? 0 : -1}
          onClick={() => setActiveTab('savings')}
          onKeyDown={handleAssetTabKeyDown}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${activeTab === 'savings' ? 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'}`}
        >
          <Landmark size={18} aria-hidden="true" />
          <span>{en ? 'Savings books' : 'Sổ tiết kiệm'}</span>
        </button>
        <button
          id={assetTabIds.gold}
          type="button"
          role="tab"
          aria-selected={activeTab === 'gold'}
          aria-controls="assets-panel-gold"
          tabIndex={activeTab === 'gold' ? 0 : -1}
          onClick={() => setActiveTab('gold')}
          onKeyDown={handleAssetTabKeyDown}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${activeTab === 'gold' ? 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'}`}
        >
          <Crown size={18} aria-hidden="true" />
          <span>{en ? 'Gold' : 'Vàng'}</span>
        </button>
      </div>
    </div>

    <div id="assets-panel-savings" role="tabpanel" aria-labelledby={assetTabIds.savings} hidden={activeTab !== 'savings'} className="space-y-5">
      {savingsEditor && canManage && <SavingsForm editor={savingsEditor} setEditor={setSavingsEditor} onSubmit={saveSavings} onCancel={closeEditors} paymentMethods={paymentMethods} busy={busy === 'savings-save'} error={formError} en={en} />}

    <section className="card overflow-hidden" aria-labelledby="savings-title">
      <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-white/10">
        <div><h3 id="savings-title" className="flex items-center gap-2 text-lg font-extrabold"><Landmark size={19} aria-hidden="true" />{en ? 'Savings books' : 'Sổ tiết kiệm'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Opening a book can create an expense transaction automatically.' : 'Khi mở sổ, hệ thống có thể tự tạo giao dịch chi để trừ tiền.'}</p></div>
        {canManage && <button type="button" className="btn-secondary asset-add-button asset-add-savings inline-flex items-center gap-2 self-start text-sm" onClick={() => openSavingsEditor()}><Plus size={16} aria-hidden="true" />{en ? 'Add book' : 'Thêm sổ'}</button>}
      </div>
      {activeSavings.length ? <div className="divide-y divide-black/10 dark:divide-white/10">{activeSavings.map((account) => <SavingsRow key={account.id} account={account} canManage={canManage} busy={busy} en={en} onEdit={() => openSavingsEditor(account)} onSettle={() => openSettlementEditor(account)} onArchive={() => void archiveSavings(account)} onDelete={() => void deleteSavings(account)} />)}</div> : <EmptyState title={en ? 'No savings books yet' : 'Chưa có sổ tiết kiệm'} description={en ? 'Add a book to start tracking principal, maturity and actual interest.' : 'Thêm một sổ để theo dõi tiền gốc, đáo hạn và lãi thực tế.'} action={canManage ? <button type="button" className="btn-secondary asset-add-button asset-add-savings inline-flex items-center gap-2" onClick={() => openSavingsEditor()}><Plus size={16} aria-hidden="true" />{en ? 'Add savings book' : 'Thêm sổ tiết kiệm'}</button> : undefined} />}
    </section>

    {settlementEditor && canManage && <SavingsSettlementForm editor={settlementEditor} setEditor={setSettlementEditor} onSubmit={saveSettlement} onCancel={closeEditors} paymentMethods={paymentMethods} busy={busy === 'settlement'} error={formError} en={en} account={data?.savingsAccounts.find((item) => item.id === settlementEditor.accountId)} />}

    {archivedSavings.length > 0 && <details className="card overflow-hidden"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 font-bold [&::-webkit-details-marker]:hidden"><span>{en ? 'Archived savings books' : 'Sổ tiết kiệm đã lưu trữ'} ({archivedSavings.length})</span><ChevronDown size={18} aria-hidden="true" /><span className="sr-only">{en ? 'Open archived savings books' : 'Mở sổ tiết kiệm đã lưu trữ'}</span></summary><div className="divide-y divide-black/10 dark:divide-white/10">{archivedSavings.map((account) => <SavingsRow key={account.id} account={account} canManage={canManage} busy={busy} en={en} onEdit={() => undefined} onSettle={() => undefined} onArchive={() => undefined} onDelete={() => void deleteSavings(account)} archived />)}</div></details>}
    </div>

    <div id="assets-panel-gold" role="tabpanel" aria-labelledby={assetTabIds.gold} hidden={activeTab !== 'gold'} className="space-y-5">
    {goldEditor && canManage && <GoldForm editor={goldEditor} setEditor={setGoldEditor} onSubmit={saveGold} onCancel={closeEditors} paymentMethods={paymentMethods} busy={busy === 'gold-save'} error={formError} en={en} hasSales={Boolean(allGoldSales.find((item) => item.goldAssetId === goldEditor.id))} />}
    {saleEditor && canManage && <GoldSaleForm editor={saleEditor} setEditor={setSaleEditor} onSubmit={saveSale} onCancel={closeEditors} paymentMethods={paymentMethods} busy={busy === 'sale'} error={formError} en={en} holding={goldHoldingSummary} />}

    <section className="card overflow-hidden" aria-labelledby="gold-title">
      <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-white/10">
        <div><h3 id="gold-title" className="flex items-center gap-2 text-lg font-extrabold"><Crown size={19} aria-hidden="true" />{en ? 'Gold' : 'Vàng'}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? 'Purchases stay in history, but selling uses the total holding. Average cost and P/L are shown below; no selling fee is included.' : 'Các lần mua vẫn được lưu lịch sử, nhưng bán theo tổng số vàng đang giữ. Giá vốn bình quân và lãi/lỗ được tổng hợp bên dưới; không tính phí bán.'}</p></div>
        {canManage && <div className="grid w-full gap-2 self-start sm:w-64"><button type="button" className="btn-primary inline-flex w-full items-center justify-center gap-2 text-sm" onClick={() => openSaleEditor()} disabled={!activeGold.length || Boolean(busy)}><Banknote size={16} aria-hidden="true" />{en ? 'Sell gold' : 'Bán vàng'}</button><button type="button" className="btn-secondary asset-add-button asset-add-gold inline-flex w-full items-center justify-center gap-2 text-sm" onClick={() => openGoldEditor()}><Plus size={16} aria-hidden="true" />{en ? 'Add gold' : 'Thêm vàng'}</button></div>}
      </div>
      <div className="grid grid-cols-2 gap-2 border-b border-black/10 p-4 dark:border-white/10 sm:grid-cols-4 sm:p-5">
        <GoldHoldingStat label={en ? 'Current quantity' : 'Số vàng hiện có'} value={`${formatQuantity(goldHoldingSummary.quantityChi)} ${goldUnitLabel(en)}`} />
        <GoldHoldingStat label={en ? 'Average cost' : 'Giá vốn bình quân'} value={goldHoldingSummary.averageCostPerChi === null ? '—' : `${formatVnd(goldHoldingSummary.averageCostPerChi)}/${goldUnitLabel(en)}`} />
        <GoldHoldingStat label={en ? 'Estimated value' : 'Giá trị ước tính'} value={goldHoldingSummary.estimatedValue === null ? '—' : formatVnd(goldHoldingSummary.estimatedValue)} />
        <GoldHoldingStat label={en ? 'Estimated P/L' : 'Lãi/lỗ tạm tính'} value={goldHoldingSummary.unrealizedPnl === null ? '—' : formatSignedVnd(goldHoldingSummary.unrealizedPnl)} tone={goldHoldingSummary.unrealizedPnl === null ? 'neutral' : goldHoldingSummary.unrealizedPnl >= 0 ? 'positive' : 'negative'} />
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
      {activeGold.length ? <div className="divide-y divide-black/10 dark:divide-white/10">{activeGold.map((asset) => <GoldRow key={asset.id} asset={asset} sales={allGoldSales.filter((item) => item.goldAssetId === asset.id)} canManage={canManage} busy={busy} en={en} onEdit={() => openGoldEditor(asset)} onDelete={() => void deleteGold(asset)} />)}</div> : <EmptyState title={en ? 'No gold yet' : 'Chưa có vàng'} description={en ? 'Add each purchase separately so purchase date and cost stay clear.' : 'Mỗi lần mua được lưu riêng để rõ ngày mua và giá vốn.'} action={canManage ? <button type="button" className="btn-secondary asset-add-button asset-add-gold inline-flex items-center gap-2" onClick={() => openGoldEditor()}><Plus size={16} aria-hidden="true" />{en ? 'Add gold' : 'Thêm vàng'}</button> : undefined} />}
      {soldGold.length > 0 && <details className="border-t border-black/10 dark:border-white/10"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 font-bold [&::-webkit-details-marker]:hidden"><span>{en ? 'Sold gold' : 'Vàng đã bán'} ({soldGold.length})</span><ChevronDown size={18} aria-hidden="true" /></summary><div className="divide-y divide-black/10 dark:divide-white/10">{soldGold.map((asset) => <GoldRow key={asset.id} asset={asset} sales={allGoldSales.filter((item) => item.goldAssetId === asset.id)} canManage={canManage} busy={busy} en={en} onEdit={() => undefined} onArchive={() => void archiveGold(asset)} onDelete={() => void deleteGold(asset)} sold />)}</div></details>}
      {archivedGold.length > 0 && <details className="border-t border-black/10 dark:border-white/10"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-bold [&::-webkit-details-marker]:hidden"><span>{en ? 'Archived gold' : 'Vàng đã lưu trữ'} ({archivedGold.length})</span><ChevronDown size={18} aria-hidden="true" /></summary><div className="divide-y divide-black/10 dark:divide-white/10">{archivedGold.map((asset) => <GoldRow key={asset.id} asset={asset} sales={allGoldSales.filter((item) => item.goldAssetId === asset.id)} canManage={canManage} busy={busy} en={en} onEdit={() => undefined} onDelete={() => void deleteGold(asset)} sold />)}</div></details>}
    </section>

    </div>
  </div>;
}

function AssetKpi({ label, value, icon: Icon, tone, meta }: { label: string; value: number; icon: typeof Landmark; tone: 'emerald' | 'amber' | 'violet' | 'sky'; meta: string }) {
  return <div className="card min-w-0 p-3 sm:p-4"><div className="flex items-start gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-xl kpi-tone-${tone}`}><Icon size={18} aria-hidden="true" /></span><p className="min-w-0 flex-1 break-words text-xs font-semibold leading-tight text-gray-500 dark:text-gray-400">{label}</p></div><p className="mt-2 break-words text-lg font-extrabold leading-tight sm:text-xl">{formatVnd(value)}</p><p className="mt-2 break-words text-xs leading-tight text-gray-500 dark:text-gray-400">{meta}</p></div>;
}

function GoldHoldingStat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'negative' }) {
  const valueClass = tone === 'positive'
    ? 'text-emerald-700 dark:text-emerald-300'
    : tone === 'negative'
      ? 'text-rose-700 dark:text-rose-300'
      : 'text-gray-900 dark:text-gray-100';
  return <div className="min-w-0 rounded-xl bg-black/[.025] p-3 dark:bg-white/[.04]"><p className="truncate text-xs text-gray-500 dark:text-gray-400">{label}</p><p className={`mt-1 break-words text-sm font-bold tabular-nums ${valueClass}`}>{value}</p></div>;
}

function SavingsRow({
  account,
  canManage,
  busy,
  en,
  onEdit,
  onSettle,
  onArchive,
  onDelete,
  archived = false,
}: {
  account: SavingsAccount;
  canManage: boolean;
  busy: string;
  en: boolean;
  onEdit: () => void;
  onSettle: () => void;
  onArchive: () => void;
  onDelete: () => void;
  archived?: boolean;
}) {
  const days = daysUntilMaturity(account.maturityOn);
  const expectedInterestToDate = expectedSavingsInterestToDate(account);
  const expectedInterestFullTerm = expectedSavingsInterest(account);
  const interestProgress = expectedInterestFullTerm > 0
    ? Math.min(Math.max((expectedInterestToDate / expectedInterestFullTerm) * 100, 0), 100)
    : 0;
  const interestProgressLabel = `${interestProgress.toLocaleString(en ? 'en-US' : 'vi-VN', { maximumFractionDigits: 1 })}%`;
  const maturityClass = days <= 30 && days >= 0 ? 'text-amber-700 dark:text-amber-300' : days < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300';
  const status = account.status === 'closed'
    ? (en ? 'Closed' : 'Đã đóng')
    : account.status === 'archived'
      ? (en ? 'Archived' : 'Đã lưu trữ')
      : (en ? 'Active' : 'Đang hoạt động');
  return (
    <article className="p-3 sm:p-4">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="min-w-0 flex-1 truncate text-base font-bold" title={`${account.bankName} · ${account.name}`}>{account.bankName} · {account.name}</h4>
            <span className="ui-chip">{status}</span>
          </div>
          <p className="mt-1 text-sm leading-tight text-gray-500 dark:text-gray-400">{en ? 'Principal' : 'Tiền gốc'} {formatVnd(account.principal)} · {formatRate(account.annualInterestRate)}% · {account.termMonths} {en ? 'mo.' : 'tháng'} · {interestMethodLabel(account.interestMethod, en)}</p>
        </div>
        <div className="text-left lg:text-right"><p className="whitespace-nowrap text-lg font-extrabold text-[var(--primary)]">{formatVnd(account.currentBalance)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{en ? 'Current balance' : 'Số dư hiện tại'}</p></div>
      </div>
      <div className={`asset-stat-row mt-2 grid grid-cols-2 gap-1.5 text-sm lg:items-stretch ${canManage ? 'lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]' : 'lg:grid-cols-4'}`}>
        <div className="asset-stat-card rounded-xl bg-black/[.025] dark:bg-white/[.04]"><p className="asset-stat-card-label text-gray-500 dark:text-gray-400">{en ? 'Opened' : 'Ngày mở'}</p><p className="asset-stat-card-value font-semibold">{formatDateOnlyVi(account.openedOn)}</p></div>
        <div className={`asset-stat-card rounded-xl bg-black/[.025] dark:bg-white/[.04] ${maturityClass}`}><p className="asset-stat-card-label">{en ? 'Maturity' : 'Đáo hạn'}</p><p className="asset-stat-card-value font-semibold">{formatDateOnlyVi(account.maturityOn)}</p><p className="asset-stat-card-hint">{days < 0 ? (en ? 'Past due' : 'Đã quá hạn') : days === 0 ? (en ? 'Today' : 'Hôm nay') : (en ? `${days} day(s) left` : `Còn ${days} ngày`)}</p></div>
        <div className="asset-stat-card rounded-xl bg-black/[.025] dark:bg-white/[.04] col-span-2 sm:col-span-2 lg:col-span-2"><div className="flex items-end justify-between gap-3"><div className="min-w-0"><p className="asset-stat-card-label text-gray-500 dark:text-gray-400">{en ? 'Interest to date / full term' : 'Lãi đến hiện tại / toàn kỳ'}</p><p className="asset-stat-card-value truncate font-semibold" title={`${formatVnd(expectedInterestToDate)} / ${formatVnd(expectedInterestFullTerm)}`}><strong>{formatVnd(expectedInterestToDate)}</strong><span className="text-gray-500 dark:text-gray-400"> / {formatVnd(expectedInterestFullTerm)}</span></p></div><span className="shrink-0 font-bold text-gray-700 dark:text-gray-200">{interestProgressLabel}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800" role="progressbar" aria-label={en ? `Savings interest progress for ${account.bankName} · ${account.name}` : `Tiến độ lãi ${account.bankName} · ${account.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={interestProgress} aria-valuetext={en ? `${formatVnd(expectedInterestToDate)} accrued of ${formatVnd(expectedInterestFullTerm)} full-term interest` : `Đã tích lũy ${formatVnd(expectedInterestToDate)} trên ${formatVnd(expectedInterestFullTerm)} lãi toàn kỳ`}><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${interestProgress}%` }} /></div><div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"><span>{en ? 'Estimated through today' : 'Ước tính đến hôm nay'}</span><span>{en ? 'If held until maturity' : 'Nếu giữ đến đáo hạn'}</span></div></div>
        {canManage && !archived && account.status === 'active' && <div role="group" className="col-span-2 flex items-center gap-1.5 lg:col-span-1 lg:justify-end" aria-label={en ? 'Savings book actions' : 'Thao tác sổ tiết kiệm'}><button type="button" className="asset-action-button asset-icon-action btn-primary inline-flex items-center justify-center" aria-label={en ? 'Settle' : 'Tất toán'} title={en ? 'Settle savings book' : 'Tất toán sổ tiết kiệm'} disabled={Boolean(busy) || account.currentBalance <= 0} onClick={onSettle}><Banknote size={18} aria-hidden="true" /></button><button type="button" className="asset-action-button asset-icon-action btn-secondary inline-flex items-center justify-center" aria-label={en ? 'Edit' : 'Sửa'} title={en ? 'Edit savings book' : 'Sửa sổ tiết kiệm'} disabled={Boolean(busy)} onClick={onEdit}><Pencil size={18} aria-hidden="true" /></button><button type="button" className="asset-action-button asset-icon-action danger-button inline-flex items-center justify-center" aria-label={en ? 'Delete' : 'Xóa'} title={en ? 'Delete savings book' : 'Xóa sổ tiết kiệm'} disabled={Boolean(busy)} onClick={onDelete}>{busy === account.id ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</button></div>}
        {canManage && !archived && account.status === 'closed' && <div role="group" className="col-span-2 flex items-center gap-1.5 lg:col-span-1 lg:justify-end" aria-label={en ? 'Savings book actions' : 'Thao tác sổ tiết kiệm'}><button type="button" className="asset-action-button asset-icon-action btn-secondary inline-flex items-center justify-center" aria-label={en ? 'Archive' : 'Lưu trữ'} title={en ? 'Archive savings book' : 'Lưu trữ sổ tiết kiệm'} disabled={Boolean(busy)} onClick={onArchive}><Archive size={18} aria-hidden="true" /></button><button type="button" className="asset-action-button asset-icon-action danger-button inline-flex items-center justify-center" aria-label={en ? 'Delete' : 'Xóa'} title={en ? 'Delete savings book' : 'Xóa sổ tiết kiệm'} disabled={Boolean(busy)} onClick={onDelete}>{busy === account.id ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</button></div>}
        {canManage && archived && <div role="group" className="col-span-2 flex items-center gap-1.5 lg:col-span-1 lg:justify-end" aria-label={en ? 'Savings book actions' : 'Thao tác sổ tiết kiệm'}><button type="button" className="asset-action-button asset-icon-action danger-button inline-flex items-center justify-center" aria-label={en ? 'Delete permanently' : 'Xóa vĩnh viễn'} title={en ? 'Delete savings book permanently' : 'Xóa vĩnh viễn sổ tiết kiệm'} disabled={Boolean(busy)} onClick={onDelete}>{busy === account.id ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</button></div>}
      </div>
      {account.note && <p className="mt-2 text-sm leading-tight text-gray-600 dark:text-gray-300">{account.note}</p>}
    </article>
  );
}

function GoldRow({
  asset,
  sales,
  canManage,
  busy,
  en,
  onEdit,
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
  onArchive?: () => void;
  onDelete: () => void;
  sold?: boolean;
}) {
  const currentValue = goldEstimatedValue(asset);
  const hasEstimate = asset.estimatedSellPricePerChi !== null;
  const unit = goldUnitLabel(en);
  return (
    <article className="p-3 sm:p-4">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="shrink-0 whitespace-nowrap text-base font-bold">{formatQuantity(asset.remainingQuantityChi)} / {formatQuantity(asset.quantityChi)} {unit}</h4>
            <span className="ui-chip">{sold || asset.status === 'archived' ? (en ? 'Sold' : 'Đã bán') : (en ? 'Active' : 'Đang giữ')}</span>
          </div>
          <p className="mt-1 text-sm leading-tight text-gray-500 dark:text-gray-400">{en ? 'Purchased' : 'Ngày mua'} {formatDateOnlyVi(asset.purchaseDate)} · {en ? 'Cost' : 'Giá mua'} {formatVnd(asset.purchasePricePerChi)}/{unit}</p>
        </div>
        <div className="text-left lg:text-right"><p className="whitespace-nowrap text-lg font-extrabold text-[var(--primary)]">{hasEstimate ? formatVnd(currentValue) : '—'}</p><p className="text-xs text-gray-500 dark:text-gray-400">{en ? 'Estimated sell value' : 'Giá trị bán ước tính'}</p></div>
      </div>
      <div className={`asset-stat-row mt-2 grid grid-cols-2 gap-1.5 text-sm lg:items-stretch ${canManage ? 'lg:grid-cols-[repeat(2,minmax(0,1fr))_auto]' : 'lg:grid-cols-2'}`}>
        <div className="asset-stat-card rounded-xl bg-black/[.025] dark:bg-white/[.04]"><p className="asset-stat-card-label text-gray-500 dark:text-gray-400">{en ? 'Purchase price' : 'Giá mua'}</p><p className="asset-stat-card-value font-semibold">{formatVnd(asset.purchasePricePerChi)}/{unit}</p></div>
        <div className="asset-stat-card rounded-xl bg-black/[.025] dark:bg-white/[.04]"><p className="asset-stat-card-label text-gray-500 dark:text-gray-400">{en ? 'Shop buy-back estimate' : 'Giá tiệm mua vào'}</p><p className="asset-stat-card-value font-semibold">{asset.estimatedSellPricePerChi === null ? (en ? 'Not entered' : 'Chưa nhập') : `${formatVnd(asset.estimatedSellPricePerChi)}/${unit}`}</p></div>
        {canManage && !sold && asset.status === 'active' && <div role="group" className="col-span-2 flex items-center gap-1.5 lg:col-span-1 lg:justify-end" aria-label={en ? 'Gold holding actions' : 'Thao tác lô vàng'}><button type="button" className="asset-action-button asset-icon-action btn-secondary inline-flex items-center justify-center" aria-label={en ? 'Edit' : 'Sửa'} title={en ? 'Edit gold lot' : 'Sửa lô vàng'} disabled={Boolean(busy)} onClick={onEdit}><Pencil size={18} aria-hidden="true" /></button><button type="button" className="asset-action-button asset-icon-action danger-button inline-flex items-center justify-center" aria-label={en ? 'Delete' : 'Xóa'} title={en ? 'Delete gold lot' : 'Xóa lô vàng'} disabled={Boolean(busy)} onClick={onDelete}>{busy === asset.id ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</button></div>}
        {canManage && sold && asset.status === 'sold' && onArchive && <div role="group" className="col-span-2 flex items-center gap-1.5 lg:col-span-1 lg:justify-end" aria-label={en ? 'Gold holding actions' : 'Thao tác lô vàng'}><button type="button" className="asset-action-button asset-icon-action btn-secondary inline-flex items-center justify-center" aria-label={en ? 'Archive' : 'Lưu trữ'} title={en ? 'Archive gold lot' : 'Lưu trữ lô vàng'} disabled={Boolean(busy)} onClick={onArchive}><Archive size={18} aria-hidden="true" /></button><button type="button" className="asset-action-button asset-icon-action danger-button inline-flex items-center justify-center" aria-label={en ? 'Delete' : 'Xóa'} title={en ? 'Delete gold lot' : 'Xóa lô vàng'} disabled={Boolean(busy)} onClick={onDelete}>{busy === asset.id ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</button></div>}
        {canManage && asset.status === 'archived' && <div role="group" className="col-span-2 flex items-center gap-1.5 lg:col-span-1 lg:justify-end" aria-label={en ? 'Gold holding actions' : 'Thao tác lô vàng'}><button type="button" className="asset-action-button asset-icon-action danger-button inline-flex items-center justify-center" aria-label={en ? 'Delete permanently' : 'Xóa vĩnh viễn'} title={en ? 'Delete gold lot permanently' : 'Xóa vĩnh viễn lô vàng'} disabled={Boolean(busy)} onClick={onDelete}>{busy === asset.id ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</button></div>}
      </div>
      {asset.note && <p className="mt-2 text-sm leading-tight text-gray-600 dark:text-gray-300">{asset.note}</p>}
      {sales.length > 0 && <details className="mt-2 rounded-xl border border-black/10 dark:border-white/10"><summary className="asset-history-toggle flex cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"><span className="min-w-0 truncate">{en ? 'Sale history' : 'Lịch sử bán'} ({sales.length})</span><ChevronDown size={17} aria-hidden="true" /></summary><div className="divide-y divide-black/10 border-t border-black/10 text-sm dark:divide-white/10 dark:border-white/10">{sales.map((sale) => <div key={sale.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5"><span className="min-w-0 break-words">{formatDateOnlyVi(sale.saleDate)} · {formatQuantity(sale.quantityChi)} {unit} · {formatVnd(sale.salePricePerChi)}/{unit}</span><span className="whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-300">+{formatVnd(sale.amount)}</span></div>)}</div></details>}
    </article>
  );
}

function PaymentSelect({ id, value, onChange, paymentMethods, en, label = 'Phương thức thanh toán' }: { id: string; value: string; onChange: (value: string) => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; en: boolean; label?: string }) {
  return <label><span className="label">{en ? 'Payment method' : label}</span><select id={id} className="field" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{en ? 'Use the default method' : 'Dùng phương thức mặc định'}</option>{paymentMethods.map((item) => <option key={item.id} value={item.id}>{getCatalogDisplayName(item, en ? 'en' : 'vi')}</option>)}</select></label>;
}

function SavingsForm({ editor, setEditor, onSubmit, onCancel, paymentMethods, busy, error, en }: { editor: SavingsForm; setEditor: (value: SavingsForm | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; busy: boolean; error: string; en: boolean }) {
  return (
    <section className="card border-[var(--primary)] p-4 sm:p-5" aria-labelledby="savings-form-title">
      <div className="flex items-start justify-between gap-3">
        <div><p className="page-kicker"><Landmark size={15} aria-hidden="true" />{en ? 'Savings book form' : 'Thông tin sổ tiết kiệm'}</p><h3 id="savings-form-title" className="text-lg font-extrabold">{editor.id ? (en ? 'Edit savings book' : 'Sửa sổ tiết kiệm') : (en ? 'Add savings book' : 'Thêm sổ tiết kiệm')}</h3></div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label={en ? 'Close savings form' : 'Đóng biểu mẫu sổ'}><X size={18} aria-hidden="true" /></button>
      </div>
      <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onSubmit}>
        <label><span className="label">{en ? 'Bank' : 'Ngân hàng'}</span><input className="field" value={editor.bankName} onChange={(event) => setEditor({ ...editor, bankName: event.target.value })} /></label>
        <label><span className="label">{en ? 'Book name' : 'Tên sổ'}</span><input className="field" value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label>
        <label><span className="label">{en ? 'Opening principal (VND)' : 'Tiền gốc (VND)'}</span><input className="field" inputMode="numeric" disabled={Boolean(editor.id)} value={editor.principal} onChange={(event) => setEditor({ ...editor, principal: event.target.value })} /><span className="mt-1 block text-xs text-gray-500">{editor.id ? (en ? 'Opening principal cannot be edited.' : 'Tiền gốc không sửa sau khi tạo.') : (en ? 'This is also the opening cash expense when enabled.' : 'Khoản này cũng là giao dịch chi mở sổ nếu bật bên dưới.')}</span></label>
        <label><span className="label">{en ? 'Annual rate (%)' : 'Lãi suất năm (%)'}</span><input className="field" type="text" inputMode="decimal" value={editor.annualInterestRate} onChange={(event) => setEditor({ ...editor, annualInterestRate: sanitizeDecimalInput(event.target.value) })} autoComplete="off" /></label>
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

function SavingsSettlementForm({ editor, setEditor, onSubmit, onCancel, paymentMethods, busy, error, en, account }: { editor: SettlementForm; setEditor: (value: SettlementForm | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; busy: boolean; error: string; en: boolean; account?: SavingsAccount }) {
  const principal = account?.currentBalance || 0;
  const interest = Number(inputAmount(editor.interestAmount)) || 0;
  return <section className="card border-[var(--primary)] p-4 sm:p-5" aria-labelledby="settlement-form-title"><div className="flex items-start justify-between gap-3"><div><p className="page-kicker"><Landmark size={15} aria-hidden="true" />{en ? 'Savings settlement' : 'Tất toán sổ tiết kiệm'}</p><h3 id="settlement-form-title" className="text-lg font-extrabold">{en ? 'Settle and record cash received' : 'Tất toán và ghi nhận tiền nhận về'}{account ? ` · ${account.bankName} - ${account.name}` : ''}</h3></div><button type="button" className="icon-button" onClick={onCancel} aria-label={en ? 'Close settlement form' : 'Đóng biểu mẫu tất toán'}><X size={18} /></button></div><form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}><div className="rounded-xl bg-[var(--primary-soft)] p-3"><p className="text-xs text-gray-500 dark:text-gray-400">{en ? 'Principal received' : 'Tiền gốc nhận về'}</p><p className="mt-1 text-lg font-extrabold">{formatVnd(principal)}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{en ? 'The current savings balance will be closed.' : 'Số dư hiện tại sẽ được đóng sổ.'}</p></div><label><span className="label">{en ? 'Interest received (VND)' : 'Lãi thực nhận (VND)'}</span><input className="field" inputMode="numeric" value={editor.interestAmount} onChange={(event) => setEditor({ ...editor, interestAmount: event.target.value })} /><span className="mt-1 block text-xs text-gray-500">{en ? 'Defaults to the estimated full-term interest; adjust it to match the bank statement.' : 'Mặc định là lãi dự kiến toàn kỳ; hãy sửa theo số tiền ngân hàng thực trả.'}</span></label><PaymentSelect id="settlement-payment" value={editor.paymentMethodId} onChange={(value) => setEditor({ ...editor, paymentMethodId: value })} paymentMethods={paymentMethods} en={en} /><label><span className="label">{en ? 'Settlement date' : 'Ngày tất toán'}</span><input className="field" type="date" value={editor.settlementDate} onChange={(event) => setEditor({ ...editor, settlementDate: event.target.value })} /></label><label><span className="label">{en ? 'Note' : 'Ghi chú'}</span><input className="field" value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} /></label><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200 sm:col-span-2"><p className="text-xs">{en ? 'Total income recorded' : 'Tổng thu nhập sẽ ghi nhận'}</p><p className="mt-1 text-lg font-extrabold">{formatVnd(principal + interest)}</p><p className="mt-1 text-xs">{en ? 'Principal and interest are recorded together, then the book is closed.' : 'Tiền gốc và tiền lãi được ghi nhận cùng lúc, sau đó sổ được đóng.'}</p></div>{error && <div role="alert" className="inline-feedback inline-feedback-error sm:col-span-2">{error}</div>}<div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button type="button" className="btn-secondary" onClick={onCancel}>{en ? 'Cancel' : 'Hủy'}</button><button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy || !account}>{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{en ? 'Settle and record' : 'Tất toán và ghi nhận'}</button></div></form></section>;
}

function GoldForm({ editor, setEditor, onSubmit, onCancel, paymentMethods, busy, error, en, hasSales }: { editor: GoldForm; setEditor: (value: GoldForm | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; busy: boolean; error: string; en: boolean; hasSales: boolean }) {
  return (
    <section className="card border-[var(--primary)] p-4 sm:p-5" aria-labelledby="gold-form-title">
      <div className="flex items-start justify-between gap-3">
        <div><p className="page-kicker"><Crown size={15} aria-hidden="true" />{en ? 'Gold form' : 'Thông tin vàng'}</p><h3 id="gold-form-title" className="text-lg font-extrabold">{editor.id ? (en ? 'Edit gold' : 'Sửa vàng') : (en ? 'Add gold' : 'Thêm vàng')}</h3></div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label={en ? 'Close gold form' : 'Đóng biểu mẫu vàng'}><X size={18} aria-hidden="true" /></button>
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

function GoldSaleForm({ editor, setEditor, onSubmit, onCancel, paymentMethods, busy, error, en, holding }: { editor: SaleForm; setEditor: (value: SaleForm | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; paymentMethods: ReturnType<typeof useApp>['paymentMethods']; busy: boolean; error: string; en: boolean; holding: GoldHoldingSummary }) {
  const quantity = Number(inputDecimal(editor.quantityChi));
  const salePrice = Number(inputAmount(editor.salePricePerChi));
  const amount = goldPurchaseAmount(quantity, salePrice);
  const estimatedPnl = holding.averageCostPerChi === null || !Number.isFinite(quantity) || !Number.isFinite(salePrice)
    ? null
    : Math.round(amount - quantity * holding.averageCostPerChi);
  const pnlClass = estimatedPnl === null
    ? 'text-gray-500 dark:text-gray-400'
    : estimatedPnl >= 0
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-rose-700 dark:text-rose-300';
  const averageCostLabel = holding.averageCostPerChi === null
    ? '—'
    : `${formatVnd(holding.averageCostPerChi)}/${en ? 'mace' : 'chỉ'}`;
  return (
    <section className="card border-[var(--primary)] p-4 sm:p-5" aria-labelledby="gold-sale-form-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="page-kicker"><Banknote size={15} aria-hidden="true" />{en ? 'Gold sale' : 'Bán vàng'}</p>
          <h3 id="gold-sale-form-title" className="text-lg font-extrabold">{en ? 'Sell from total holding' : 'Bán theo tổng số vàng hiện có'}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{en ? `${formatQuantity(holding.quantityChi)} mace available · average cost ${averageCostLabel}` : `${formatQuantity(holding.quantityChi)} chỉ hiện có · giá vốn bình quân ${averageCostLabel}`}</p>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label={en ? 'Close sale form' : 'Đóng biểu mẫu bán vàng'}><X size={18} /></button>
      </div>
      <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onSubmit}>
        <label><span className="label">{en ? 'Sale date' : 'Ngày bán'}</span><input className="field" type="date" value={editor.saleDate} onChange={(event) => setEditor({ ...editor, saleDate: event.target.value })} /></label>
        <label><span className="label">{en ? 'Quantity (mace)' : 'Số lượng (chỉ)'}</span><input className="field" inputMode="decimal" step="0.001" value={editor.quantityChi} onChange={(event) => setEditor({ ...editor, quantityChi: event.target.value })} /><span className="mt-1 block text-xs text-gray-500">{en ? `Maximum ${formatQuantity(holding.quantityChi)} mace` : `Tối đa ${formatQuantity(holding.quantityChi)} chỉ`}</span></label>
        <label><span className="label">{en ? 'Sale price per mace (VND)' : 'Giá bán / chỉ (VND)'}</span><input className="field" inputMode="numeric" value={editor.salePricePerChi} onChange={(event) => setEditor({ ...editor, salePricePerChi: event.target.value })} /></label>
        <PaymentSelect id="sale-payment" value={editor.paymentMethodId} onChange={(value) => setEditor({ ...editor, paymentMethodId: value })} paymentMethods={paymentMethods} en={en} />
        <label><span className="label">{en ? 'Note' : 'Ghi chú'}</span><input className="field" value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} /></label>
        <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
          <p className="text-xs">{en ? 'Income created' : 'Thu nhập sẽ tạo'}</p>
          <p className="mt-1 font-bold">{formatVnd(Number.isFinite(amount) ? amount : 0)}</p>
          <p className={`mt-1 text-xs font-semibold ${pnlClass}`}>{en ? 'P/L at average cost' : 'Lãi/lỗ theo giá vốn bình quân'}: {estimatedPnl === null ? '—' : `${estimatedPnl >= 0 ? '+' : ''}${formatVnd(estimatedPnl)}`}</p>
          <p className="mt-1 text-xs">{en ? 'No selling fee' : 'Không tính phí bán'}</p>
        </div>
        {error && <div role="alert" className="inline-feedback inline-feedback-error sm:col-span-2 lg:col-span-3">{error}</div>}
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-3"><button type="button" className="btn-secondary" onClick={onCancel}>{en ? 'Cancel' : 'Hủy'}</button><button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy}>{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{en ? 'Sell and record income' : 'Bán và ghi thu nhập'}</button></div>
      </form>
    </section>
  );
}

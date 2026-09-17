import { z } from 'zod';
import type { Transaction } from './domain';

export const savingsInterestMethods = [
  'end_of_term',
  'monthly',
  'upfront',
  'renew',
] as const;
export type SavingsInterestMethod = (typeof savingsInterestMethods)[number];

export const savingsMovementTypes = [
  'opening',
  'interest',
  'withdrawal',
  'fee',
  'settlement',
] as const;
export type SavingsMovementType = (typeof savingsMovementTypes)[number];

export const savingsStatuses = ['active', 'closed', 'archived'] as const;
export type SavingsStatus = (typeof savingsStatuses)[number];
export const goldStatuses = ['active', 'sold', 'archived'] as const;
export type GoldStatus = (typeof goldStatuses)[number];

const positiveAmount = z.number().finite().positive().max(999_999_999_999_999);

export const savingsAccountInputSchema = z
  .object({
    bankName: z.string().trim().min(1, 'Vui lòng nhập tên ngân hàng').max(120),
    name: z.string().trim().min(1, 'Vui lòng nhập tên sổ').max(120),
    principal: positiveAmount,
    annualInterestRate: z.number().finite().min(0).max(100),
    termMonths: z.number().int().min(1).max(120),
    openedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Vui lòng chọn ngày mở'),
    maturityOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Vui lòng chọn ngày đáo hạn'),
    interestMethod: z.enum(savingsInterestMethods),
    paymentMethodId: z.string().nullable().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.maturityOn >= value.openedOn, {
    path: ['maturityOn'],
    message: 'Ngày đáo hạn phải sau ngày mở',
  });
export type SavingsAccountInput = z.infer<typeof savingsAccountInputSchema>;

export const savingsMovementInputSchema = z.object({
  type: z.enum(['interest', 'withdrawal', 'fee', 'settlement']),
  amount: positiveAmount,
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Vui lòng chọn ngày'),
  paymentMethodId: z.string().nullable().optional(),
  note: z.string().trim().max(500).optional(),
});
export type SavingsMovementInput = z.infer<typeof savingsMovementInputSchema>;

export const savingsSettlementInputSchema = z.object({
  interestAmount: z.number().finite().int().nonnegative().max(999_999_999_999_999),
  settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Vui lòng chọn ngày tất toán'),
  paymentMethodId: z.string().nullable().optional(),
  note: z.string().trim().max(500).optional(),
});
export type SavingsSettlementInput = z.infer<typeof savingsSettlementInputSchema>;

export const goldAssetInputSchema = z.object({
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Vui lòng chọn ngày mua'),
  quantityChi: z.number().finite().positive().max(999_999),
  purchasePricePerChi: z.number().finite().int().positive().max(999_999_999_999),
  estimatedSellPricePerChi: z.number().finite().int().positive().max(999_999_999_999).nullable().optional(),
  paymentMethodId: z.string().nullable().optional(),
  note: z.string().trim().max(500).optional(),
});
export type GoldAssetInput = z.infer<typeof goldAssetInputSchema>;

export const goldSaleInputSchema = z.object({
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Vui lòng chọn ngày bán'),
  quantityChi: z.number().finite().positive().max(999_999),
  salePricePerChi: z.number().finite().int().positive().max(999_999_999_999),
  paymentMethodId: z.string().nullable().optional(),
  note: z.string().trim().max(500).optional(),
});
export type GoldSaleInput = z.infer<typeof goldSaleInputSchema>;

export const goldBuybackPriceInputSchema = z.number().finite().int().positive().max(999_999_999_999).nullable();

export type SavingsAccount = {
  id: string;
  familyId: string;
  bankName: string;
  name: string;
  principal: number;
  currentBalance: number;
  annualInterestRate: number;
  termMonths: number;
  openedOn: string;
  maturityOn: string;
  interestMethod: SavingsInterestMethod;
  status: SavingsStatus;
  note: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string | null;
  archivedAt?: string | null;
};

export type SavingsMovement = {
  id: string;
  familyId: string;
  savingsAccountId: string;
  movementType: SavingsMovementType;
  amount: number;
  balanceAfter: number;
  movementDate: string;
  paymentMethodId: string | null;
  transactionId: string | null;
  note: string | null;
  createdBy?: string;
  createdAt?: string;
};

export type GoldAsset = {
  id: string;
  familyId: string;
  purchaseDate: string;
  quantityChi: number;
  remainingQuantityChi: number;
  purchasePricePerChi: number;
  estimatedSellPricePerChi: number | null;
  status: GoldStatus;
  transactionId: string | null;
  note: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
};

export type GoldSale = {
  id: string;
  familyId: string;
  goldAssetId: string;
  saleDate: string;
  quantityChi: number;
  salePricePerChi: number;
  amount: number;
  paymentMethodId: string | null;
  transactionId: string | null;
  note: string | null;
  createdBy?: string;
  createdAt?: string;
};

export type GoldHoldingSummary = {
  quantityChi: number;
  cost: number;
  averageCostPerChi: number | null;
  estimatedValue: number | null;
  unrealizedPnl: number | null;
};

export type AssetData = {
  savingsAccounts: SavingsAccount[];
  savingsMovements: SavingsMovement[];
  goldAssets: GoldAsset[];
  goldSales: GoldSale[];
  goldBuybackPricePerChi: number | null;
};

export type AssetSummary = {
  netCash: number;
  savingsTotal: number;
  goldEstimatedTotal: number;
  goldCost: number;
  goldQuantityChi: number;
  savingsCount: number;
  goldCount: number;
  goldMissingEstimateCount: number;
  goldBuybackPricePerChi: number | null;
  savings: SavingsAccount[];
  gold: GoldAsset[];
};

export const canManageAssets = (role: 'owner' | 'member' | null | undefined) =>
  role === 'owner' || role === 'member';

export const formatAssetMoneyInput = (value: string | number) => {
  const digits = String(value).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const sanitizeDecimalInput = (value: string) => {
  const normalized = value.replace(/,/g, '.');
  const [whole = '', ...fraction] = normalized.split('.');
  const wholeDigits = whole.replace(/\D/g, '');
  const fractionDigits = fraction.join('').replace(/\D/g, '');
  return fraction.length > 0 ? `${wholeDigits}.${fractionDigits}` : wholeDigits;
};

export const calculateSavingsMaturityDate = (openedOn: string, termMonths: number) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(openedOn);
  if (!match || !Number.isInteger(termMonths) || termMonths <= 0) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + termMonths, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(Number(match[3]), lastDay));
  return date.toISOString().slice(0, 10);
};

const localStorageKey = (familyId: string, kind: string) =>
  `family-expense:${kind}:${familyId}`;

const localId = (prefix: string) =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `local-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const readStored = <T>(key: string, isItem: (value: unknown) => value is T) => {
  if (typeof window === 'undefined') return [] as T[];
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) || '[]') as unknown;
    return Array.isArray(raw) ? raw.filter(isItem) : [];
  } catch {
    return [] as T[];
  }
};

const readStoredNumber = (key: string): { configured: boolean; value: number | null } => {
  if (typeof window === 'undefined') return { configured: false, value: null };
  const raw = window.localStorage.getItem(key);
  if (raw === null) return { configured: false, value: null };
  try {
    const value = JSON.parse(raw) as unknown;
    return {
      configured: true,
      value: typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0 ? value : null,
    };
  } catch {
    return { configured: true, value: null };
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const isSavingsAccount = (value: unknown): value is SavingsAccount => {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.familyId === 'string' &&
    typeof value.bankName === 'string' &&
    typeof value.name === 'string' &&
    typeof value.principal === 'number' &&
    typeof value.currentBalance === 'number' &&
    typeof value.annualInterestRate === 'number' &&
    typeof value.termMonths === 'number' &&
    typeof value.openedOn === 'string' &&
    typeof value.maturityOn === 'string' &&
    savingsInterestMethods.includes(value.interestMethod as SavingsInterestMethod) &&
    savingsStatuses.includes(value.status as SavingsStatus)
  );
};

const isSavingsMovement = (value: unknown): value is SavingsMovement => {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.familyId === 'string' &&
    typeof value.savingsAccountId === 'string' &&
    savingsMovementTypes.includes(value.movementType as SavingsMovementType) &&
    typeof value.amount === 'number' &&
    typeof value.balanceAfter === 'number' &&
    typeof value.movementDate === 'string'
  );
};

const isGoldAsset = (value: unknown): value is GoldAsset => {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.familyId === 'string' &&
    typeof value.purchaseDate === 'string' &&
    typeof value.quantityChi === 'number' &&
    typeof value.remainingQuantityChi === 'number' &&
    typeof value.purchasePricePerChi === 'number' &&
    (value.estimatedSellPricePerChi === null || typeof value.estimatedSellPricePerChi === 'number') &&
    goldStatuses.includes(value.status as GoldStatus)
  );
};

const isGoldSale = (value: unknown): value is GoldSale => {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.familyId === 'string' &&
    typeof value.goldAssetId === 'string' &&
    typeof value.saleDate === 'string' &&
    typeof value.quantityChi === 'number' &&
    typeof value.salePricePerChi === 'number' &&
    typeof value.amount === 'number'
  );
};

const saveStored = <T>(key: string, values: T[]) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(values));
};

export function getLocalAssetData(familyId: string): AssetData {
  const storedGoldAssets = readStored(localStorageKey(familyId, 'gold-assets'), isGoldAsset);
  const storedPrice = readStoredNumber(localStorageKey(familyId, 'gold-buyback-price'));
  const legacyPrice = storedGoldAssets.find((item) => item.estimatedSellPricePerChi !== null)?.estimatedSellPricePerChi ?? null;
  const goldBuybackPricePerChi = storedPrice.configured ? storedPrice.value : legacyPrice;
  return {
    savingsAccounts: readStored(localStorageKey(familyId, 'savings-accounts'), isSavingsAccount),
    savingsMovements: readStored(localStorageKey(familyId, 'savings-movements'), isSavingsMovement),
    goldAssets: storedGoldAssets.map((asset) => ({ ...asset, estimatedSellPricePerChi: goldBuybackPricePerChi })),
    goldSales: readStored(localStorageKey(familyId, 'gold-sales'), isGoldSale),
    goldBuybackPricePerChi,
  };
}

export function setLocalGoldBuybackPrice(familyId: string, pricePerChi: number | null) {
  if (typeof window !== 'undefined')
    window.localStorage.setItem(localStorageKey(familyId, 'gold-buyback-price'), JSON.stringify(pricePerChi));
}

const dateToDay = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

export const daysBetween = (from: string, to: string) => {
  const start = dateToDay(from);
  const end = dateToDay(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86_400_000);
};

export const todayInVietnam = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const daysUntilMaturity = (maturityOn: string, today = todayInVietnam()) =>
  daysBetween(today, maturityOn);

export const expectedSavingsInterestToDate = (
  account: Pick<SavingsAccount, 'principal' | 'annualInterestRate' | 'openedOn' | 'maturityOn'>,
  today = todayInVietnam(),
) => {
  const termDays = Math.max(daysBetween(account.openedOn, account.maturityOn), 0);
  const elapsedDays = Math.min(Math.max(daysBetween(account.openedOn, today), 0), termDays);
  return Math.round(account.principal * (account.annualInterestRate / 100) * elapsedDays / 365);
};

export const expectedSavingsInterest = (account: Pick<SavingsAccount, 'principal' | 'annualInterestRate' | 'openedOn' | 'maturityOn'>) =>
  expectedSavingsInterestToDate(account, account.maturityOn);

export const goldPurchaseAmount = (quantityChi: number, pricePerChi: number) =>
  Math.round(quantityChi * pricePerChi);

export const goldEstimatedValue = (asset: Pick<GoldAsset, 'remainingQuantityChi' | 'estimatedSellPricePerChi'>) =>
  asset.estimatedSellPricePerChi === null
    ? 0
    : Math.round(asset.remainingQuantityChi * asset.estimatedSellPricePerChi);

export const goldCostValue = (asset: Pick<GoldAsset, 'remainingQuantityChi' | 'purchasePricePerChi'>) =>
  Math.round(asset.remainingQuantityChi * asset.purchasePricePerChi);

export const summarizeGoldHoldings = (
  assets: Array<Pick<GoldAsset, 'remainingQuantityChi' | 'purchasePricePerChi'>>,
  buybackPricePerChi: number | null,
): GoldHoldingSummary => {
  const quantityChi = assets.reduce((total, asset) => total + asset.remainingQuantityChi, 0);
  const cost = Math.round(assets.reduce(
    (total, asset) => total + asset.remainingQuantityChi * asset.purchasePricePerChi,
    0,
  ));
  const averageCostPerChi = quantityChi > 0 ? cost / quantityChi : null;
  const estimatedValue = buybackPricePerChi === null
    ? null
    : Math.round(quantityChi * buybackPricePerChi);
  return {
    quantityChi,
    cost,
    averageCostPerChi,
    estimatedValue,
    unrealizedPnl: estimatedValue === null ? null : estimatedValue - cost,
  };
};

export type LocalAssetTransactionInput = {
  familyId: string;
  currentUserId: string;
  date: string;
  transactionType: Transaction['transactionType'];
  description: string;
  amount: number;
  purposeId: string;
  expenseTypeId: string;
  paymentMethodId: string;
  sourceReference: string;
};

export const makeLocalAssetTransaction = (input: LocalAssetTransactionInput): Transaction => ({
  id: localId('asset-transaction'),
  familyId: input.familyId,
  transactionDate: input.date,
  transactionType: input.transactionType,
  status: input.date <= todayInVietnam() ? 'Thực tế' : 'Dự kiến',
  description: input.description,
  amount: input.amount,
  purposeId: input.purposeId,
  expenseTypeId: input.expenseTypeId,
  paymentMethodId: input.paymentMethodId,
  note: null,
  source: 'asset',
  sourceReference: input.sourceReference,
  aiGenerated: false,
  createdBy: input.currentUserId,
  createdAt: new Date().toISOString(),
  deletedAt: null,
});

export type LocalAssetKind = 'savings' | 'gold';

export const assetTransactionReferencePrefix = (kind: LocalAssetKind, assetId: string) =>
  `asset:${kind}:${assetId}:`;

export const isLocalAssetTransaction = (
  transaction: Pick<Transaction, 'source' | 'sourceReference'>,
  kind: LocalAssetKind,
  assetId: string,
) => transaction.source === 'asset'
  && transaction.sourceReference?.startsWith(assetTransactionReferencePrefix(kind, assetId)) === true;

export function upsertLocalSavingsAccount(
  familyId: string,
  input: SavingsAccountInput,
  id: string | undefined,
  openingTransactionId?: string | null,
): SavingsAccount {
  const key = localStorageKey(familyId, 'savings-accounts');
  const items = readStored(key, isSavingsAccount);
  const current = items.find((item) => item.id === id);
  const next: SavingsAccount = current
    ? {
        ...current,
        bankName: input.bankName.trim(),
        name: input.name.trim(),
        annualInterestRate: input.annualInterestRate,
        termMonths: input.termMonths,
        openedOn: input.openedOn,
        maturityOn: input.maturityOn,
        interestMethod: input.interestMethod,
        note: input.note?.trim() || null,
      }
    : {
        id: id || localId('savings'),
        familyId,
        bankName: input.bankName.trim(),
        name: input.name.trim(),
        principal: input.principal,
        currentBalance: input.principal,
        annualInterestRate: input.annualInterestRate,
        termMonths: input.termMonths,
        openedOn: input.openedOn,
        maturityOn: input.maturityOn,
        interestMethod: input.interestMethod,
        status: 'active',
        note: input.note?.trim() || null,
        createdBy: 'local-user',
        createdAt: new Date().toISOString(),
      };
  saveStored(key, [...items.filter((item) => item.id !== next.id), next]);

  if (!current) {
    const movementKey = localStorageKey(familyId, 'savings-movements');
    const movements = readStored(movementKey, isSavingsMovement);
    const opening: SavingsMovement = {
      id: localId('savings-opening'),
      familyId,
      savingsAccountId: next.id,
      movementType: 'opening',
      amount: next.principal,
      balanceAfter: next.principal,
      movementDate: next.openedOn,
      paymentMethodId: input.paymentMethodId || null,
      transactionId: openingTransactionId || null,
      note: next.note,
      createdBy: 'local-user',
      createdAt: new Date().toISOString(),
    };
    saveStored(movementKey, [...movements, opening]);
  }
  return next;
}

export function recordLocalSavingsMovement(
  familyId: string,
  accountId: string,
  input: SavingsMovementInput,
  transactionId?: string | null,
  movementId?: string,
): { account: SavingsAccount; movement: SavingsMovement } {
  const accountKey = localStorageKey(familyId, 'savings-accounts');
  const accounts = readStored(accountKey, isSavingsAccount);
  const current = accounts.find((item) => item.id === accountId);
  if (!current || current.status !== 'active') throw new Error('ACCOUNT_NOT_ACTIVE');
  if (input.type !== 'interest' && input.amount > current.currentBalance) throw new Error('INSUFFICIENT_BALANCE');
  const nextBalance = input.type === 'interest' ? current.currentBalance : current.currentBalance - input.amount;
  const nextAccount: SavingsAccount = {
    ...current,
    currentBalance: nextBalance,
    status: input.type === 'settlement' ? 'closed' : current.status,
    closedAt: input.type === 'settlement' ? new Date().toISOString() : current.closedAt,
  };
  saveStored(accountKey, accounts.map((item) => item.id === accountId ? nextAccount : item));
  const movement: SavingsMovement = {
    id: movementId || localId('savings-movement'),
    familyId,
    savingsAccountId: accountId,
    movementType: input.type,
    amount: input.amount,
    balanceAfter: nextBalance,
    movementDate: input.movementDate,
    paymentMethodId: input.paymentMethodId || null,
    transactionId: transactionId || null,
    note: input.note?.trim() || null,
    createdBy: 'local-user',
    createdAt: new Date().toISOString(),
  };
  const movementKey = localStorageKey(familyId, 'savings-movements');
  saveStored(movementKey, [...readStored(movementKey, isSavingsMovement), movement]);
  return { account: nextAccount, movement };
}

export function settleLocalSavingsAccount(
  familyId: string,
  accountId: string,
  input: SavingsSettlementInput,
  settlementTransactionId?: string | null,
  interestTransactionId?: string | null,
  settlementMovementId?: string,
  interestMovementId?: string,
): { account: SavingsAccount; settlementMovement: SavingsMovement; interestMovement: SavingsMovement | null } {
  const accountKey = localStorageKey(familyId, 'savings-accounts');
  const accounts = readStored(accountKey, isSavingsAccount);
  const current = accounts.find((item) => item.id === accountId);
  if (!current || current.status !== 'active') throw new Error('ACCOUNT_NOT_ACTIVE');
  if (current.currentBalance <= 0) throw new Error('ACCOUNT_EMPTY');
  if (!Number.isInteger(input.interestAmount) || input.interestAmount < 0) throw new Error('INVALID_INTEREST_AMOUNT');

  const createdAt = new Date().toISOString();
  const nextAccount: SavingsAccount = {
    ...current,
    currentBalance: 0,
    status: 'closed',
    closedAt: createdAt,
  };
  const note = input.note?.trim() || null;
  const settlementMovement: SavingsMovement = {
    id: settlementMovementId || localId('savings-settlement'),
    familyId,
    savingsAccountId: accountId,
    movementType: 'settlement',
    amount: current.currentBalance,
    balanceAfter: 0,
    movementDate: input.settlementDate,
    paymentMethodId: input.paymentMethodId || null,
    transactionId: settlementTransactionId || null,
    note,
    createdBy: 'local-user',
    createdAt,
  };
  const interestMovement = input.interestAmount > 0
    ? {
        id: interestMovementId || localId('savings-settlement-interest'),
        familyId,
        savingsAccountId: accountId,
        movementType: 'interest' as const,
        amount: input.interestAmount,
        balanceAfter: 0,
        movementDate: input.settlementDate,
        paymentMethodId: input.paymentMethodId || null,
        transactionId: interestTransactionId || null,
        note,
        createdBy: 'local-user',
        createdAt,
      }
    : null;
  saveStored(accountKey, accounts.map((item) => item.id === accountId ? nextAccount : item));
  const movementKey = localStorageKey(familyId, 'savings-movements');
  const movements = readStored(movementKey, isSavingsMovement);
  saveStored(movementKey, [...movements, settlementMovement, ...(interestMovement ? [interestMovement] : [])]);
  return { account: nextAccount, settlementMovement, interestMovement };
}

export function archiveLocalSavingsAccount(familyId: string, accountId: string) {
  const key = localStorageKey(familyId, 'savings-accounts');
  const items = readStored(key, isSavingsAccount);
  const current = items.find((item) => item.id === accountId);
  if (!current || current.status !== 'closed' || current.currentBalance !== 0) throw new Error('ACCOUNT_NOT_CLOSED');
  saveStored(key, items.map((item) => item.id === accountId ? { ...item, status: 'archived', archivedAt: new Date().toISOString() } : item));
}

export function deleteLocalSavingsAccount(familyId: string, accountId: string) {
  const accountKey = localStorageKey(familyId, 'savings-accounts');
  const accounts = readStored(accountKey, isSavingsAccount);
  const account = accounts.find((item) => item.id === accountId);
  if (!account) throw new Error('NOT_FOUND');
  saveStored(accountKey, accounts.filter((item) => item.id !== accountId));

  const movementKey = localStorageKey(familyId, 'savings-movements');
  const movements = readStored(movementKey, isSavingsMovement);
  saveStored(movementKey, movements.filter((item) => item.savingsAccountId !== accountId));
  return Array.from(new Set(movements
    .filter((item) => item.savingsAccountId === accountId)
    .map((item) => item.transactionId)
    .filter((id): id is string => Boolean(id))));
}

export function upsertLocalGoldAsset(
  familyId: string,
  input: GoldAssetInput,
  id: string | undefined,
  purchaseTransactionId?: string | null,
): GoldAsset {
  const key = localStorageKey(familyId, 'gold-assets');
  const items = readStored(key, isGoldAsset);
  const current = items.find((item) => item.id === id);
  const sales = readStored(localStorageKey(familyId, 'gold-sales'), isGoldSale).filter((sale) => sale.goldAssetId === id);
  if (current && sales.length && (current.quantityChi !== input.quantityChi || current.purchasePricePerChi !== input.purchasePricePerChi)) throw new Error('ASSET_HAS_SALES');
  const next: GoldAsset = current
    ? {
        ...current,
        purchaseDate: input.purchaseDate,
        quantityChi: input.quantityChi,
        remainingQuantityChi: sales.length ? current.remainingQuantityChi : input.quantityChi,
        purchasePricePerChi: input.purchasePricePerChi,
        estimatedSellPricePerChi: input.estimatedSellPricePerChi ?? null,
        note: input.note?.trim() || null,
      }
    : {
        id: id || localId('gold'),
        familyId,
        purchaseDate: input.purchaseDate,
        quantityChi: input.quantityChi,
        remainingQuantityChi: input.quantityChi,
        purchasePricePerChi: input.purchasePricePerChi,
        estimatedSellPricePerChi: input.estimatedSellPricePerChi ?? null,
        status: 'active',
        transactionId: purchaseTransactionId || null,
        note: input.note?.trim() || null,
        createdBy: 'local-user',
        createdAt: new Date().toISOString(),
      };
  saveStored(key, [...items.filter((item) => item.id !== next.id), next]);
  return next;
}

export function recordLocalGoldSale(
  familyId: string,
  assetId: string,
  input: GoldSaleInput,
  transactionId?: string | null,
  saleId?: string,
): { asset: GoldAsset; sale: GoldSale } {
  const assetKey = localStorageKey(familyId, 'gold-assets');
  const assets = readStored(assetKey, isGoldAsset);
  const current = assets.find((item) => item.id === assetId);
  if (!current || current.status !== 'active') throw new Error('ASSET_NOT_ACTIVE');
  if (input.quantityChi > current.remainingQuantityChi) throw new Error('INSUFFICIENT_QUANTITY');
  const remaining = Math.max(0, Number((current.remainingQuantityChi - input.quantityChi).toFixed(3)));
  const nextAsset: GoldAsset = {
    ...current,
    remainingQuantityChi: remaining,
    status: remaining === 0 ? 'sold' : 'active',
  };
  saveStored(assetKey, assets.map((item) => item.id === assetId ? nextAsset : item));
  const sale: GoldSale = {
    id: saleId || localId('gold-sale'),
    familyId,
    goldAssetId: assetId,
    saleDate: input.saleDate,
    quantityChi: input.quantityChi,
    salePricePerChi: input.salePricePerChi,
    amount: goldPurchaseAmount(input.quantityChi, input.salePricePerChi),
    paymentMethodId: input.paymentMethodId || null,
    transactionId: transactionId || null,
    note: input.note?.trim() || null,
    createdBy: 'local-user',
    createdAt: new Date().toISOString(),
  };
  const saleKey = localStorageKey(familyId, 'gold-sales');
  saveStored(saleKey, [...readStored(saleKey, isGoldSale), sale]);
  return { asset: nextAsset, sale };
}

export function recordLocalGoldSaleAggregate(
  familyId: string,
  input: GoldSaleInput,
  transactionId?: string | null,
): { assets: GoldAsset[]; sales: GoldSale[] } {
  if (!Number.isFinite(input.quantityChi) || input.quantityChi <= 0 || input.quantityChi > 999_999) {
    throw new Error('INVALID_QUANTITY');
  }
  if (input.quantityChi !== Number(input.quantityChi.toFixed(3))) throw new Error('INVALID_QUANTITY');

  const assetKey = localStorageKey(familyId, 'gold-assets');
  const assets = readStored(assetKey, isGoldAsset);
  const active = assets
    .filter((item) => item.status === 'active' && item.remainingQuantityChi > 0)
    .sort((left, right) => left.purchaseDate.localeCompare(right.purchaseDate)
      || (left.createdAt || '').localeCompare(right.createdAt || '')
      || left.id.localeCompare(right.id));
  const availableQuantity = active.reduce((total, asset) => total + asset.remainingQuantityChi, 0);
  if (input.quantityChi > availableQuantity) throw new Error('INSUFFICIENT_QUANTITY');

  const saleAmount = goldPurchaseAmount(input.quantityChi, input.salePricePerChi);
  if (saleAmount <= 0) throw new Error('INVALID_AMOUNT');

  const remainingByAsset = new Map<string, number>();
  const sales: GoldSale[] = [];
  let remainingToSell = input.quantityChi;
  let allocatedAmount = 0;
  for (const asset of active) {
    if (remainingToSell <= 0) break;
    const isLastAllocation = remainingToSell <= asset.remainingQuantityChi;
    const quantity = Number(Math.min(remainingToSell, asset.remainingQuantityChi).toFixed(3));
    const remaining = Math.max(0, Number((asset.remainingQuantityChi - quantity).toFixed(3)));
    const amount = isLastAllocation
      ? saleAmount - allocatedAmount
      : goldPurchaseAmount(quantity, input.salePricePerChi);
    if (amount <= 0) throw new Error('INVALID_AMOUNT');
    remainingByAsset.set(asset.id, remaining);
    sales.push({
      id: localId('gold-sale'),
      familyId,
      goldAssetId: asset.id,
      saleDate: input.saleDate,
      quantityChi: quantity,
      salePricePerChi: input.salePricePerChi,
      amount,
      paymentMethodId: input.paymentMethodId || null,
      transactionId: transactionId || null,
      note: input.note?.trim() || null,
      createdBy: 'local-user',
      createdAt: new Date().toISOString(),
    });
    allocatedAmount += amount;
    remainingToSell = Math.max(0, Number((remainingToSell - quantity).toFixed(3)));
  }

  const nextAssets = assets.map((asset) => {
    const remaining = remainingByAsset.get(asset.id);
    if (remaining === undefined) return asset;
    return {
      ...asset,
      remainingQuantityChi: remaining,
      status: remaining === 0 ? 'sold' : 'active',
    } satisfies GoldAsset;
  });
  saveStored(assetKey, nextAssets);
  const saleKey = localStorageKey(familyId, 'gold-sales');
  saveStored(saleKey, [...readStored(saleKey, isGoldSale), ...sales]);
  return { assets: nextAssets, sales };
}

export function archiveLocalGoldAsset(familyId: string, assetId: string) {
  const key = localStorageKey(familyId, 'gold-assets');
  const items = readStored(key, isGoldAsset);
  const current = items.find((item) => item.id === assetId);
  if (!current || current.status !== 'sold' || current.remainingQuantityChi !== 0) throw new Error('ASSET_NOT_SOLD');
  saveStored(key, items.map((item) => item.id === assetId ? { ...item, status: 'archived', archivedAt: new Date().toISOString() } : item));
}

export function deleteLocalGoldAsset(familyId: string, assetId: string) {
  const assetKey = localStorageKey(familyId, 'gold-assets');
  const assets = readStored(assetKey, isGoldAsset);
  const asset = assets.find((item) => item.id === assetId);
  if (!asset) throw new Error('NOT_FOUND');
  saveStored(assetKey, assets.filter((item) => item.id !== assetId));

  const saleKey = localStorageKey(familyId, 'gold-sales');
  const sales = readStored(saleKey, isGoldSale);
  const nextSales = sales.filter((item) => item.goldAssetId !== assetId);
  saveStored(saleKey, nextSales);
  return Array.from(new Set([
    asset.transactionId,
    ...sales.filter((item) => item.goldAssetId === assetId).map((item) => item.transactionId),
  ].filter((id): id is string => Boolean(id) && !nextSales.some((sale) => sale.transactionId === id))));
}

export function buildLocalAssetSummary(familyId: string, transactions: Transaction[]): AssetSummary {
  const data = getLocalAssetData(familyId);
  const savings = data.savingsAccounts.filter((item) => item.status !== 'archived');
  const gold = data.goldAssets.filter((item) => item.status === 'active');
  const actualTransactions = transactions.filter((item) => !item.deletedAt && item.status === 'Thực tế');
  const netCash = actualTransactions.reduce((total, item) => total + (item.transactionType === 'Thu nhập' ? item.amount : -item.amount), 0);
  const goldSummary = summarizeGoldHoldings(gold, data.goldBuybackPricePerChi);
  return {
    netCash,
    savingsTotal: savings.reduce((total, item) => total + item.currentBalance, 0),
    goldEstimatedTotal: goldSummary.estimatedValue ?? 0,
    goldCost: goldSummary.cost,
    goldQuantityChi: goldSummary.quantityChi,
    savingsCount: savings.length,
    goldCount: gold.length,
    goldMissingEstimateCount: gold.filter((item) => item.estimatedSellPricePerChi === null).length,
    goldBuybackPricePerChi: data.goldBuybackPricePerChi,
    savings,
    gold,
  };
}

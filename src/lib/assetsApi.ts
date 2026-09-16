import { supabase } from './supabase';
import type {
  AssetData,
  AssetSummary,
  GoldAsset,
  GoldAssetInput,
  GoldSale,
  GoldSaleInput,
  SavingsAccount,
  SavingsAccountInput,
  SavingsMovement,
  SavingsMovementInput,
  SavingsSettlementInput,
} from './assets';

type SavingsAccountRow = {
  id: string;
  family_id: string;
  bank_name: string;
  name: string;
  principal: number | string;
  current_balance: number | string;
  annual_interest_rate: number | string;
  term_months: number;
  opened_on: string;
  maturity_on: string;
  interest_method: SavingsAccount['interestMethod'];
  status: SavingsAccount['status'];
  note: string | null;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  archived_at?: string | null;
};

type SavingsMovementRow = {
  id: string;
  family_id: string;
  savings_account_id: string;
  movement_type: SavingsMovement['movementType'];
  amount: number | string;
  balance_after: number | string;
  movement_date: string;
  payment_method_id: string | null;
  transaction_id: string | null;
  note: string | null;
  created_by?: string;
  created_at?: string;
};

type GoldAssetRow = {
  id: string;
  family_id: string;
  purchase_date: string;
  quantity_chi: number | string;
  remaining_quantity_chi: number | string;
  purchase_price_per_chi: number | string;
  estimated_sell_price_per_chi: number | string | null;
  status: GoldAsset['status'];
  transaction_id: string | null;
  note: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
};

type GoldSaleRow = {
  id: string;
  family_id: string;
  gold_asset_id: string;
  sale_date: string;
  quantity_chi: number | string;
  sale_price_per_chi: number | string;
  amount: number | string;
  payment_method_id: string | null;
  transaction_id: string | null;
  note: string | null;
  created_by?: string;
  created_at?: string;
};

const mapSavingsAccount = (row: SavingsAccountRow): SavingsAccount => ({
  id: row.id,
  familyId: row.family_id,
  bankName: row.bank_name,
  name: row.name,
  principal: Number(row.principal),
  currentBalance: Number(row.current_balance),
  annualInterestRate: Number(row.annual_interest_rate),
  termMonths: Number(row.term_months),
  openedOn: row.opened_on,
  maturityOn: row.maturity_on,
  interestMethod: row.interest_method,
  status: row.status,
  note: row.note,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  closedAt: row.closed_at,
  archivedAt: row.archived_at,
});

const mapSavingsMovement = (row: SavingsMovementRow): SavingsMovement => ({
  id: row.id,
  familyId: row.family_id,
  savingsAccountId: row.savings_account_id,
  movementType: row.movement_type,
  amount: Number(row.amount),
  balanceAfter: Number(row.balance_after),
  movementDate: row.movement_date,
  paymentMethodId: row.payment_method_id,
  transactionId: row.transaction_id,
  note: row.note,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const mapGoldAsset = (row: GoldAssetRow, goldBuybackPricePerChi?: number | null): GoldAsset => ({
  id: row.id,
  familyId: row.family_id,
  purchaseDate: row.purchase_date,
  quantityChi: Number(row.quantity_chi),
  remainingQuantityChi: Number(row.remaining_quantity_chi),
  purchasePricePerChi: Number(row.purchase_price_per_chi),
  estimatedSellPricePerChi: goldBuybackPricePerChi === undefined
    ? row.estimated_sell_price_per_chi === null ? null : Number(row.estimated_sell_price_per_chi)
    : goldBuybackPricePerChi,
  status: row.status,
  transactionId: row.transaction_id,
  note: row.note,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  archivedAt: row.archived_at,
});

const mapGoldSale = (row: GoldSaleRow): GoldSale => ({
  id: row.id,
  familyId: row.family_id,
  goldAssetId: row.gold_asset_id,
  saleDate: row.sale_date,
  quantityChi: Number(row.quantity_chi),
  salePricePerChi: Number(row.sale_price_per_chi),
  amount: Number(row.amount),
  paymentMethodId: row.payment_method_id,
  transactionId: row.transaction_id,
  note: row.note,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export async function fetchAssetData(familyId: string): Promise<AssetData> {
  const [savingsResult, movementsResult, goldResult, salesResult, familyResult] = await Promise.all([
    supabase.from('savings_accounts').select('*').eq('family_id', familyId).order('maturity_on', { ascending: true }),
    supabase.from('savings_movements').select('*').eq('family_id', familyId).order('movement_date', { ascending: false }),
    supabase.from('gold_assets').select('*').eq('family_id', familyId).order('purchase_date', { ascending: false }),
    supabase.from('gold_sales').select('*').eq('family_id', familyId).order('sale_date', { ascending: false }),
    supabase.from('families').select('gold_buyback_price_per_chi').eq('id', familyId).maybeSingle(),
  ]);
  const error = savingsResult.error || movementsResult.error || goldResult.error || salesResult.error || familyResult.error;
  if (error) throw error;
  const goldBuybackPricePerChi = familyResult.data?.gold_buyback_price_per_chi === null || familyResult.data?.gold_buyback_price_per_chi === undefined
    ? null
    : Number(familyResult.data.gold_buyback_price_per_chi);
  return {
    savingsAccounts: ((savingsResult.data || []) as SavingsAccountRow[]).map(mapSavingsAccount),
    savingsMovements: ((movementsResult.data || []) as SavingsMovementRow[]).map(mapSavingsMovement),
    goldAssets: ((goldResult.data || []) as GoldAssetRow[]).map((row) => mapGoldAsset(row, goldBuybackPricePerChi)),
    goldSales: ((salesResult.data || []) as GoldSaleRow[]).map(mapGoldSale),
    goldBuybackPricePerChi,
  };
}

export async function upsertSavingsAccount(
  familyId: string,
  input: SavingsAccountInput,
  id: string | undefined,
  createTransaction: boolean,
) {
  const { data, error } = await supabase.rpc('upsert_savings_account', {
    p_family_id: familyId,
    p_id: id || null,
    p_bank_name: input.bankName,
    p_name: input.name,
    p_principal: input.principal,
    p_annual_interest_rate: input.annualInterestRate,
    p_term_months: input.termMonths,
    p_opened_on: input.openedOn,
    p_maturity_on: input.maturityOn,
    p_interest_method: input.interestMethod,
    p_payment_method_id: input.paymentMethodId || null,
    p_note: input.note || null,
    p_create_transaction: createTransaction,
  });
  if (error) throw error;
  return data;
}

export async function recordSavingsMovement(
  familyId: string,
  accountId: string,
  input: SavingsMovementInput,
) {
  const { data, error } = await supabase.rpc('record_savings_movement', {
    p_family_id: familyId,
    p_savings_account_id: accountId,
    p_movement_type: input.type,
    p_amount: input.amount,
    p_movement_date: input.movementDate,
    p_payment_method_id: input.paymentMethodId || null,
    p_note: input.note || null,
    p_close_account: input.type === 'settlement',
  });
  if (error) throw error;
  return data;
}

export async function settleSavingsAccount(
  familyId: string,
  accountId: string,
  input: SavingsSettlementInput,
) {
  const { data, error } = await supabase.rpc('settle_savings_account', {
    p_family_id: familyId,
    p_savings_account_id: accountId,
    p_interest_amount: input.interestAmount,
    p_settlement_date: input.settlementDate,
    p_payment_method_id: input.paymentMethodId || null,
    p_note: input.note || null,
  });
  if (error) throw error;
  return data;
}

export async function archiveSavingsAccount(familyId: string, id: string) {
  const { data, error } = await supabase.rpc('archive_savings_account', {
    p_family_id: familyId,
    p_id: id,
  });
  if (error) throw error;
  return data;
}

export async function deleteSavingsAccount(familyId: string, id: string) {
  const { data, error } = await supabase.rpc('delete_savings_account', {
    p_family_id: familyId,
    p_id: id,
  });
  if (error) throw error;
  return data;
}

export async function upsertGoldAsset(
  familyId: string,
  input: GoldAssetInput,
  id: string | undefined,
  createTransaction: boolean,
) {
  const { data, error } = await supabase.rpc('upsert_gold_asset', {
    p_family_id: familyId,
    p_id: id || null,
    p_purchase_date: input.purchaseDate,
    p_quantity_chi: input.quantityChi,
    p_purchase_price_per_chi: input.purchasePricePerChi,
    p_estimated_sell_price_per_chi: input.estimatedSellPricePerChi ?? null,
    p_payment_method_id: input.paymentMethodId || null,
    p_note: input.note || null,
    p_create_transaction: createTransaction,
  });
  if (error) throw error;
  return data;
}

export async function recordGoldSale(
  familyId: string,
  assetId: string,
  input: GoldSaleInput,
) {
  const { data, error } = await supabase.rpc('record_gold_sale', {
    p_family_id: familyId,
    p_gold_asset_id: assetId,
    p_sale_date: input.saleDate,
    p_quantity_chi: input.quantityChi,
    p_sale_price_per_chi: input.salePricePerChi,
    p_payment_method_id: input.paymentMethodId || null,
    p_note: input.note || null,
  });
  if (error) throw error;
  return data;
}

export async function archiveGoldAsset(familyId: string, id: string) {
  const { data, error } = await supabase.rpc('archive_gold_asset', {
    p_family_id: familyId,
    p_id: id,
  });
  if (error) throw error;
  return data;
}

export async function deleteGoldAsset(familyId: string, id: string) {
  const { data, error } = await supabase.rpc('delete_gold_asset', {
    p_family_id: familyId,
    p_id: id,
  });
  if (error) throw error;
  return data;
}

export async function setGoldBuybackPrice(familyId: string, pricePerChi: number | null) {
  const { data, error } = await supabase.rpc('set_gold_buyback_price', {
    p_family_id: familyId,
    p_price_per_chi: pricePerChi,
  });
  if (error) throw error;
  return data;
}

export async function fetchAssetSummary(familyId: string): Promise<AssetSummary> {
  const { data, error } = await supabase.rpc('get_asset_summary', {
    p_family_id: familyId,
  });
  if (error) throw error;
  const result = (data || {}) as Omit<Partial<AssetSummary>, 'savings' | 'gold' | 'goldBuybackPricePerChi'> & {
    savings?: SavingsAccountRow[];
    gold?: GoldAssetRow[];
    goldBuybackPricePerChi?: number | string | null;
  };
  const goldBuybackPricePerChi = result.goldBuybackPricePerChi === null || result.goldBuybackPricePerChi === undefined
    ? null
    : Number(result.goldBuybackPricePerChi);
  return {
    netCash: Number(result.netCash || 0),
    savingsTotal: Number(result.savingsTotal || 0),
    goldEstimatedTotal: Number(result.goldEstimatedTotal || 0),
    goldCost: Number(result.goldCost || 0),
    goldQuantityChi: Number(result.goldQuantityChi || 0),
    savingsCount: Number(result.savingsCount || 0),
    goldCount: Number(result.goldCount || 0),
    goldMissingEstimateCount: Number(result.goldMissingEstimateCount || 0),
    savings: (result.savings || []).map(mapSavingsAccount),
    gold: (result.gold || []).map((row) => mapGoldAsset(row, goldBuybackPricePerChi)),
    goldBuybackPricePerChi,
  };
}

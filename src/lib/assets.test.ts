import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildLocalAssetSummary,
  canManageAssets,
  calculateSavingsMaturityDate,
  deleteLocalGoldAsset,
  deleteLocalSavingsAccount,
  expectedSavingsInterest,
  expectedSavingsInterestToDate,
  formatAssetMoneyInput,
  sanitizeDecimalInput,
  goldEstimatedValue,
  goldPurchaseAmount,
  goldAssetInputSchema,
  getLocalAssetData,
  isLocalAssetTransaction,
  recordLocalSavingsMovement,
  recordLocalGoldSale,
  savingsAccountInputSchema,
  savingsMovementInputSchema,
  upsertLocalGoldAsset,
  upsertLocalSavingsAccount,
  setLocalGoldBuybackPrice,
} from './assets';

describe('asset domain', () => {
  beforeEach(() => window.localStorage.clear());

  it('formats asset money inputs with Vietnamese thousand separators', () => {
    expect(formatAssetMoneyInput('5000000')).toBe('5.000.000');
    expect(formatAssetMoneyInput('5.000.000')).toBe('5.000.000');
    expect(formatAssetMoneyInput('')).toBe('');
  });

  it('keeps only one decimal separator and numeric characters while typing', () => {
    expect(sanitizeDecimalInput('8sda')).toBe('8');
    expect(sanitizeDecimalInput('8,25')).toBe('8.25');
    expect(sanitizeDecimalInput('1.2.3')).toBe('1.23');
    expect(sanitizeDecimalInput('8.')).toBe('8.');
  });

  it('allows both owners and members to manage assets', () => {
    expect(canManageAssets('owner')).toBe(true);
    expect(canManageAssets('member')).toBe(true);
    expect(canManageAssets(null)).toBe(false);
  });

  it('calculates maturity from opening date and term, including month-end dates', () => {
    expect(calculateSavingsMaturityDate('2026-07-26', 6)).toBe('2027-01-26');
    expect(calculateSavingsMaturityDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(calculateSavingsMaturityDate('', 6)).toBe('');
  });

  it('calculates savings interest and days-independent gold amount deterministically', () => {
    const account = {
      principal: 100_000_000,
      annualInterestRate: 6,
      openedOn: '2026-01-01',
      maturityOn: '2026-07-01',
    };
    expect(expectedSavingsInterest(account)).toBe(Math.round(100_000_000 * 0.06 * 181 / 365));
    expect(goldPurchaseAmount(1.25, 8_000_000)).toBe(10_000_000);
  });

  it('calculates savings interest through today and caps it at maturity', () => {
    const account = {
      principal: 100_000_000,
      annualInterestRate: 6,
      openedOn: '2026-01-01',
      maturityOn: '2026-07-01',
    };

    expect(expectedSavingsInterestToDate(account, '2026-04-02')).toBe(
      Math.round(100_000_000 * 0.06 * 91 / 365),
    );
    expect(expectedSavingsInterestToDate(account, '2026-12-31')).toBe(expectedSavingsInterest(account));
    expect(expectedSavingsInterestToDate(account, '2025-12-31')).toBe(0);
  });

  it('keeps a gold lot quantity and estimated value after a partial sale', () => {
    const input = goldAssetInputSchema.parse({
      purchaseDate: '2026-01-01',
      quantityChi: 2,
      purchasePricePerChi: 7_500_000,
      estimatedSellPricePerChi: 8_000_000,
      paymentMethodId: 'cash',
    });
    const asset = upsertLocalGoldAsset('family-a', input, 'gold-1', null);
    const sale = {
      saleDate: '2026-02-01',
      quantityChi: 0.5,
      salePricePerChi: 8_000_000,
      paymentMethodId: 'cash',
    };
    const saved = recordLocalGoldSale('family-a', asset.id, goldAssetInputToSale(sale), 'tx-1', 'sale-1');
    expect(saved.asset.remainingQuantityChi).toBe(1.5);
    expect(goldEstimatedValue(saved.asset)).toBe(12_000_000);
    expect(saved.sale.amount).toBe(4_000_000);
  });

  it('applies one shared buy-back price to every local gold lot', () => {
    const first = goldAssetInputSchema.parse({
      purchaseDate: '2026-01-01',
      quantityChi: 1,
      purchasePricePerChi: 7_500_000,
      estimatedSellPricePerChi: 8_000_000,
    });
    const second = goldAssetInputSchema.parse({
      purchaseDate: '2026-02-01',
      quantityChi: 2,
      purchasePricePerChi: 8_000_000,
      estimatedSellPricePerChi: 9_000_000,
    });
    upsertLocalGoldAsset('family-a', first, 'gold-1', null);
    upsertLocalGoldAsset('family-a', second, 'gold-2', null);

    setLocalGoldBuybackPrice('family-a', 10_000_000);
    const shared = getLocalAssetData('family-a');
    expect(shared.goldBuybackPricePerChi).toBe(10_000_000);
    expect(shared.goldAssets.map((asset) => asset.estimatedSellPricePerChi)).toEqual([10_000_000, 10_000_000]);

    setLocalGoldBuybackPrice('family-a', null);
    expect(getLocalAssetData('family-a').goldAssets.every((asset) => asset.estimatedSellPricePerChi === null)).toBe(true);
  });

  it('tracks savings movements and net cash from actual transactions', () => {
    const accountInput = savingsAccountInputSchema.parse({
      bankName: 'ACB',
      name: 'Sổ 6 tháng',
      principal: 50_000_000,
      annualInterestRate: 5,
      termMonths: 6,
      openedOn: '2026-01-01',
      maturityOn: '2026-07-01',
      interestMethod: 'end_of_term',
      paymentMethodId: 'bank',
    });
    const account = upsertLocalSavingsAccount('family-a', accountInput, 'saving-1', 'tx-opening');
    const movement = savingsMovementInputSchema.parse({
      type: 'interest',
      amount: 1_200_000,
      movementDate: '2026-07-01',
      paymentMethodId: 'bank',
    });
    const changed = recordLocalSavingsMovement('family-a', account.id, movement, 'tx-interest', 'movement-1');
    expect(changed.account.currentBalance).toBe(50_000_000);
    expect(changed.movement.transactionId).toBe('tx-interest');

    const summary = buildLocalAssetSummary('family-a', [
      {
        id: 'tx-opening',
        familyId: 'family-a',
        transactionDate: '2026-01-01',
        transactionType: 'Chi tiêu',
        status: 'Thực tế',
        description: 'Gửi tiết kiệm',
        amount: 50_000_000,
        purposeId: 'purpose',
        expenseTypeId: 'savings',
        paymentMethodId: 'bank',
        source: 'asset',
        aiGenerated: false,
      },
      {
        id: 'tx-interest',
        familyId: 'family-a',
        transactionDate: '2026-07-01',
        transactionType: 'Thu nhập',
        status: 'Thực tế',
        description: 'Lãi',
        amount: 1_200_000,
        purposeId: 'purpose',
        expenseTypeId: 'interest',
        paymentMethodId: 'bank',
        source: 'asset',
        aiGenerated: false,
      },
    ]);
    expect(summary.netCash).toBe(-48_800_000);
    expect(summary.savingsTotal).toBe(50_000_000);
  });

  it('deletes local assets, their histories and only their linked transactions', () => {
    const familyId = 'family-delete';
    const accountInput = savingsAccountInputSchema.parse({
      bankName: 'ACB',
      name: 'Sổ cần xóa',
      principal: 20_000_000,
      annualInterestRate: 5,
      termMonths: 6,
      openedOn: '2026-01-01',
      maturityOn: '2026-07-01',
      interestMethod: 'end_of_term',
      paymentMethodId: 'bank',
    });
    const account = upsertLocalSavingsAccount(familyId, accountInput, 'saving-delete', 'tx-opening');
    recordLocalSavingsMovement(
      familyId,
      account.id,
      savingsMovementInputSchema.parse({
        type: 'interest',
        amount: 500_000,
        movementDate: '2026-07-01',
        paymentMethodId: 'bank',
      }),
      'tx-interest',
      'movement-delete',
    );
    const gold = upsertLocalGoldAsset(familyId, goldAssetInputSchema.parse({
      purchaseDate: '2026-01-01',
      quantityChi: 1,
      purchasePricePerChi: 8_000_000,
      estimatedSellPricePerChi: 8_500_000,
    }), 'gold-delete', 'tx-purchase');
    recordLocalGoldSale(familyId, gold.id, goldAssetInputToSale({
      saleDate: '2026-02-01',
      quantityChi: 0.25,
      salePricePerChi: 8_500_000,
      paymentMethodId: 'cash',
    }), 'tx-sale', 'sale-delete');

    deleteLocalSavingsAccount(familyId, account.id);
    deleteLocalGoldAsset(familyId, gold.id);

    const data = getLocalAssetData(familyId);
    expect(data.savingsAccounts).toEqual([]);
    expect(data.savingsMovements).toEqual([]);
    expect(data.goldAssets).toEqual([]);
    expect(data.goldSales).toEqual([]);
    expect(isLocalAssetTransaction({ source: 'asset', sourceReference: 'asset:savings:saving-delete:movement:movement-delete' }, 'savings', account.id)).toBe(true);
    expect(isLocalAssetTransaction({ source: 'asset', sourceReference: 'asset:gold:other:purchase' }, 'gold', gold.id)).toBe(false);
    expect(isLocalAssetTransaction({ source: 'manual', sourceReference: 'asset:savings:saving-delete:opening' }, 'savings', account.id)).toBe(false);
  });
});

function goldAssetInputToSale(input: {
  saleDate: string;
  quantityChi: number;
  salePricePerChi: number;
  paymentMethodId: string;
}) {
  return {
    saleDate: input.saleDate,
    quantityChi: input.quantityChi,
    salePricePerChi: input.salePricePerChi,
    paymentMethodId: input.paymentMethodId,
    note: '',
  };
}

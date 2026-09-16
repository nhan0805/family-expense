import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildLocalAssetSummary,
  expectedSavingsInterest,
  goldEstimatedValue,
  goldPurchaseAmount,
  goldAssetInputSchema,
  recordLocalSavingsMovement,
  recordLocalGoldSale,
  savingsAccountInputSchema,
  savingsMovementInputSchema,
  upsertLocalGoldAsset,
  upsertLocalSavingsAccount,
} from './assets';

describe('asset domain', () => {
  beforeEach(() => window.localStorage.clear());

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


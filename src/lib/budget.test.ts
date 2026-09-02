import { beforeEach, describe, expect, it } from 'vitest';
import type { CatalogItem, Transaction } from './domain';
import {
  buildLocalBudgetSummary,
  calculateBudgetStatus,
  calculateBudgetUsage,
  formatBudgetInput,
  parseBudgetInput,
  upsertLocalBudget,
} from './budget';

const purposes: CatalogItem[] = [
  { id: 'p1', name: 'Sinh hoạt', nameEn: 'Family living' },
  { id: 'p2', name: 'Du lịch', nameEn: 'Travel' },
];

const transaction = (
  id: string,
  purposeId: string,
  amount: number,
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id,
  transactionDate: '2026-09-01',
  amount,
  transactionType: 'Chi tiêu',
  status: 'Thực tế',
  description: id,
  purposeId,
  expenseTypeId: 'e1',
  paymentMethodId: 'm1',
  source: 'manual',
  aiGenerated: false,
  ...overrides,
});

describe('budget helpers', () => {
  beforeEach(() => window.localStorage.clear());

  it('tính đúng trạng thái, phần trăm sử dụng và định dạng tiền VND', () => {
    expect(calculateBudgetStatus(null, 100)).toBe('unconfigured');
    expect(calculateBudgetStatus(0, 0)).toBe('within');
    expect(calculateBudgetStatus(0, 1)).toBe('over');
    expect(calculateBudgetStatus(1_000_000, 800_000)).toBe('warning');
    expect(calculateBudgetStatus(1_000_000, 1_000_000)).toBe('over');
    expect(calculateBudgetUsage(null, 100)).toBeNull();
    expect(calculateBudgetUsage(1_000_000, 250_000)).toBe(25);
    expect(formatBudgetInput(1_250_000)).toBe('1.250.000');
    expect(parseBudgetInput(' 1.250.000 ₫ ')).toBe(1_250_000);
    expect(Number.isNaN(parseBudgetInput(''))).toBe(true);
  });

  it('chỉ tính chi tiêu thực tế và tách phần chưa có ngân sách', () => {
    upsertLocalBudget({
      year: 2026,
      month: 9,
      purposeId: 'p1',
      amount: 1_000_000,
      warningThreshold: 0.8,
    });

    const summary = buildLocalBudgetSummary(
      purposes,
      [
        transaction('actual-budgeted', 'p1', 800_000),
        transaction('actual-unbudgeted', 'p2', 500_000),
        transaction('planned', 'p1', 900_000, { status: 'Dự kiến' }),
        transaction('income', 'p1', 400_000, { transactionType: 'Thu nhập' }),
        transaction('deleted', 'p1', 300_000, { deletedAt: '2026-09-02T00:00:00Z' }),
        transaction('other-month', 'p1', 700_000, { transactionDate: '2026-08-31' }),
      ],
      2026,
      9,
    );

    expect(summary).toMatchObject({
      totalBudget: 1_000_000,
      totalSpent: 1_300_000,
      budgetedSpent: 800_000,
      unbudgetedSpent: 500_000,
      totalRemaining: 200_000,
      budgetCount: 1,
      warningCount: 1,
      overCount: 0,
    });
    expect(summary.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ purposeId: 'p1', status: 'warning', spent: 800_000 }),
      expect.objectContaining({ purposeId: 'p2', status: 'unconfigured', spent: 500_000 }),
    ]));
  });

  it('loại mục đích tắt theo dõi khỏi toàn bộ tổng hợp ngân sách', () => {
    const hiddenPurpose: CatalogItem = { id: 'p3', name: 'Thu nhập', budgetEnabled: false };
    upsertLocalBudget({
      year: 2026,
      month: 9,
      purposeId: 'p3',
      amount: 1_000_000,
      warningThreshold: 0.8,
    });
    const summary = buildLocalBudgetSummary(
      [...purposes, hiddenPurpose],
      [
        transaction('hidden-purpose', 'p3', 900_000),
        transaction('visible-purpose', 'p2', 500_000),
      ],
      2026,
      9,
    );

    expect(summary.totalSpent).toBe(500_000);
    expect(summary.unbudgetedSpent).toBe(500_000);
    expect(summary.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ purposeId: 'p3' }),
    ]));

    const restored = buildLocalBudgetSummary(
      [...purposes, { ...hiddenPurpose, budgetEnabled: true }],
      [transaction('restored-purpose', 'p3', 900_000)],
      2026,
      9,
    );
    expect(restored).toMatchObject({ totalBudget: 1_000_000, totalSpent: 900_000 });
    expect(restored.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ purposeId: 'p3', budget: 1_000_000, spent: 900_000 }),
    ]));
  });
});

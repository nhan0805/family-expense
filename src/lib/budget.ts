import { z } from 'zod';
import type { CatalogItem, Transaction } from './domain';

export const budgetStatuses = ['unconfigured', 'within', 'warning', 'over'] as const;
export type BudgetStatus = (typeof budgetStatuses)[number];

export const budgetInputSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  purposeId: z.string().min(1),
  amount: z.number().finite().min(0).max(999_999_999_999_999),
  warningThreshold: z.number().finite().gt(0).lte(1),
});

export type BudgetInput = z.infer<typeof budgetInputSchema>;

export const budgetSummaryItemSchema = z.object({
  purposeId: z.string(),
  budgetId: z.string().nullable().optional(),
  name: z.string(),
  nameEn: z.string().nullable().optional(),
  budget: z.number().nullable(),
  spent: z.number().finite(),
  remaining: z.number().nullable(),
  usagePercent: z.number().nullable(),
  warningThreshold: z.number().finite().gt(0).lte(1),
  status: z.enum(budgetStatuses),
});

export type BudgetSummaryItem = z.infer<typeof budgetSummaryItemSchema>;

export const budgetSummarySchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  totalBudget: z.number().finite(),
  totalSpent: z.number().finite(),
  budgetedSpent: z.number().finite(),
  unbudgetedSpent: z.number().finite(),
  totalRemaining: z.number().finite(),
  budgetCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  overCount: z.number().int().nonnegative(),
  items: z.array(budgetSummaryItemSchema),
});

export type BudgetSummary = z.infer<typeof budgetSummarySchema>;

export type LocalBudget = {
  id: string;
  year: number;
  month: number;
  purposeId: string;
  amount: number;
  warningThreshold: number;
};

const localBudgetStorageKey = 'family-expense-budgets';

export function calculateBudgetStatus(
  budget: number | null,
  spent: number,
  warningThreshold = 0.8,
): BudgetStatus {
  if (budget === null) return 'unconfigured';
  if (budget === 0) return spent > 0 ? 'over' : 'within';
  if (spent >= budget) return 'over';
  if (spent >= budget * warningThreshold) return 'warning';
  return 'within';
}

export function calculateBudgetUsage(
  budget: number | null,
  spent: number,
): number | null {
  if (budget === null) return null;
  if (budget === 0) return spent > 0 ? 100 : 0;
  return (spent / budget) * 100;
}

export function formatBudgetInput(value: number) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('vi-VN') : '';
}

export function parseBudgetInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : Number.NaN;
}

export function getLocalBudgets(): LocalBudget[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(localBudgetStorageKey) || '[]',
    );
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is LocalBudget => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return (
        typeof row.id === 'string' &&
        typeof row.year === 'number' &&
        typeof row.month === 'number' &&
        typeof row.purposeId === 'string' &&
        typeof row.amount === 'number' &&
        typeof row.warningThreshold === 'number'
      );
    });
  } catch {
    return [];
  }
}

function saveLocalBudgets(items: LocalBudget[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(localBudgetStorageKey, JSON.stringify(items));
  }
}

function newLocalBudgetId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `local-budget-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function upsertLocalBudget(input: BudgetInput): LocalBudget {
  const items = getLocalBudgets();
  const existing = items.find(
    (item) =>
      item.year === input.year &&
      item.month === input.month &&
      item.purposeId === input.purposeId,
  );
  const next: LocalBudget = {
    id: existing?.id || newLocalBudgetId(),
    year: input.year,
    month: input.month,
    purposeId: input.purposeId,
    amount: input.amount,
    warningThreshold: input.warningThreshold,
  };
  saveLocalBudgets([
    ...items.filter((item) => item.id !== existing?.id),
    next,
  ]);
  return next;
}

export function deleteLocalBudget(id: string) {
  saveLocalBudgets(getLocalBudgets().filter((item) => item.id !== id));
}

export function copyLocalBudgets(
  sourceYear: number,
  sourceMonth: number,
  targetYear: number,
  targetMonth: number,
) {
  const items = getLocalBudgets();
  const source = items.filter(
    (item) => item.year === sourceYear && item.month === sourceMonth,
  );
  const target = items.filter(
    (item) => item.year !== targetYear || item.month !== targetMonth,
  );
  const copied = source.map((item) => ({
    ...item,
    id: newLocalBudgetId(),
    year: targetYear,
    month: targetMonth,
  }));
  saveLocalBudgets([...target, ...copied]);
  return copied.length;
}

export function buildLocalBudgetSummary(
  purposes: CatalogItem[],
  transactions: Transaction[],
  year: number,
  month: number,
): BudgetSummary {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const budgetablePurposes = purposes.filter((purpose) => purpose.budgetEnabled !== false);
  const budgetablePurposeIds = new Set(budgetablePurposes.map((purpose) => purpose.id));
  const spentByPurpose = new Map<string, number>();
  transactions.forEach((transaction) => {
    if (
      transaction.deletedAt ||
      transaction.status !== 'Thực tế' ||
      transaction.transactionType !== 'Chi tiêu' ||
      !budgetablePurposeIds.has(transaction.purposeId) ||
      !transaction.transactionDate.startsWith(monthKey)
    )
      return;
    spentByPurpose.set(
      transaction.purposeId,
      (spentByPurpose.get(transaction.purposeId) || 0) + transaction.amount,
    );
  });

  const budgetMap = new Map(
    getLocalBudgets()
      .filter((item) => item.year === year && item.month === month)
      .map((item) => [item.purposeId, item]),
  );
  const items = budgetablePurposes.map((purpose) => {
    const budgetRow = budgetMap.get(purpose.id);
    const budget = budgetRow?.amount ?? null;
    const spent = spentByPurpose.get(purpose.id) || 0;
    const warningThreshold = budgetRow?.warningThreshold || 0.8;
    return {
      purposeId: purpose.id,
      budgetId: budgetRow?.id || null,
      name: purpose.name,
      nameEn: purpose.nameEn || null,
      budget,
      spent,
      remaining: budget === null ? null : budget - spent,
      usagePercent: calculateBudgetUsage(budget, spent),
      warningThreshold,
      status: calculateBudgetStatus(budget, spent, warningThreshold),
    } satisfies BudgetSummaryItem;
  });
  const configuredItems = items.filter((item) => item.budget !== null);
  const totalSpent = [...spentByPurpose.values()].reduce(
    (total, value) => total + value,
    0,
  );
  const budgetedSpent = configuredItems.reduce(
    (total, item) => total + item.spent,
    0,
  );
  return {
    year,
    month,
    totalBudget: configuredItems.reduce(
      (total, item) => total + (item.budget || 0),
      0,
    ),
    totalSpent,
    budgetedSpent,
    unbudgetedSpent: totalSpent - budgetedSpent,
    totalRemaining: configuredItems.reduce(
      (total, item) => total + (item.remaining || 0),
      0,
    ),
    budgetCount: configuredItems.length,
    warningCount: items.filter((item) => item.status === 'warning').length,
    overCount: items.filter((item) => item.status === 'over').length,
    items,
  };
}

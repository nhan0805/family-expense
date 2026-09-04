import { z } from 'zod';
import type { BudgetSummary } from './budget';

export const budgetNotificationKinds = ['warning', 'over'] as const;
export type BudgetNotificationKind = (typeof budgetNotificationKinds)[number];

const budgetNotificationSchema = z.object({
  id: z.string().min(1),
  familyId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  purposeId: z.string().min(1),
  purposeName: z.string().min(1),
  purposeNameEn: z.string().nullable(),
  budget: z.number().finite(),
  spent: z.number().finite(),
  usagePercent: z.number().finite().nullable(),
  thresholdPercent: z.number().finite(),
  kind: z.enum(budgetNotificationKinds),
  createdAt: z.string().min(1),
  readAt: z.string().nullable(),
  lastNotifiedKind: z.enum(budgetNotificationKinds).nullable(),
});

const budgetNotificationsSchema = z.array(budgetNotificationSchema);
export type BudgetNotification = z.infer<typeof budgetNotificationSchema>;

const storageKey = 'family-expense-budget-notifications';

export function budgetNotificationId(
  familyId: string,
  year: number,
  month: number,
  purposeId: string,
) {
  return `budget:${familyId}:${year}-${String(month).padStart(2, '0')}:${purposeId}`;
}

export function buildBudgetNotifications(
  familyId: string,
  summary: BudgetSummary,
  now = new Date(),
): BudgetNotification[] {
  return summary.items
    .filter((item) => item.budget !== null && (item.status === 'warning' || item.status === 'over'))
    .map((item) => ({
      id: budgetNotificationId(familyId, summary.year, summary.month, item.purposeId),
      familyId,
      year: summary.year,
      month: summary.month,
      purposeId: item.purposeId,
      purposeName: item.name,
      purposeNameEn: item.nameEn || null,
      budget: item.budget as number,
      spent: item.spent,
      usagePercent: item.usagePercent,
      thresholdPercent: item.warningThreshold * 100,
      kind: item.status === 'over' ? 'over' : 'warning',
      createdAt: now.toISOString(),
      readAt: null,
      lastNotifiedKind: null,
    } satisfies BudgetNotification));
}

function readStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    const result = budgetNotificationsSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function writeStorage(items: BudgetNotification[]) {
  if (typeof window !== 'undefined')
    window.localStorage.setItem(storageKey, JSON.stringify(items));
}

function sortNotifications(items: BudgetNotification[]) {
  return [...items].sort((a, b) => {
    if (a.readAt === null && b.readAt !== null) return -1;
    if (a.readAt !== null && b.readAt === null) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function getBudgetNotifications(familyId: string) {
  return sortNotifications(readStorage().filter((item) => item.familyId === familyId));
}

export function syncBudgetNotifications(
  familyId: string,
  summary: BudgetSummary,
  now = new Date(),
) {
  const stored = readStorage();
  const current = buildBudgetNotifications(familyId, summary, now);
  const byId = new Map(stored.map((item) => [item.id, item]));
  const newNotifications: BudgetNotification[] = [];

  current.forEach((item) => {
    const previous = byId.get(item.id);
    if (!previous) {
      const next = { ...item, lastNotifiedKind: item.kind } satisfies BudgetNotification;
      byId.set(item.id, next);
      newNotifications.push(next);
      return;
    }

    const kindChanged = previous.kind !== item.kind;
    const shouldNotify = previous.lastNotifiedKind === null ||
      (previous.lastNotifiedKind === 'warning' && item.kind === 'over');
    const highestNotifiedKind = previous.lastNotifiedKind === 'over' || item.kind === 'over'
      ? 'over'
      : 'warning';
    const next = {
      ...item,
      createdAt: previous.createdAt,
      readAt: kindChanged && item.kind === 'over' ? null : previous.readAt,
      lastNotifiedKind: highestNotifiedKind,
    } satisfies BudgetNotification;
    if (shouldNotify) {
      newNotifications.push(next);
    }
    byId.set(item.id, next);
  });

  const nextStorage = [...byId.values()];
  writeStorage(nextStorage);
  return {
    notifications: sortNotifications(nextStorage.filter((item) => item.familyId === familyId)),
    newNotifications,
  };
}

export function markBudgetNotificationRead(id: string, now = new Date()) {
  const next = readStorage().map((item) =>
    item.id === id ? { ...item, readAt: now.toISOString() } : item,
  );
  writeStorage(next);
  return next.find((item) => item.id === id) || null;
}

export function markAllBudgetNotificationsRead(familyId: string, now = new Date()) {
  const readAt = now.toISOString();
  const next = readStorage().map((item) =>
    item.familyId === familyId ? { ...item, readAt } : item,
  );
  writeStorage(next);
  return sortNotifications(next.filter((item) => item.familyId === familyId));
}

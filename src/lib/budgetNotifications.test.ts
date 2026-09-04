import { beforeEach, describe, expect, it } from 'vitest';
import type { BudgetSummary } from './budget';
import {
  getBudgetNotifications,
  markAllBudgetNotificationsRead,
  markBudgetNotificationRead,
  syncBudgetNotifications,
} from './budgetNotifications';

const summary = (status: 'warning' | 'over' = 'warning'): BudgetSummary => ({
  year: 2026,
  month: 9,
  totalBudget: 1_000_000,
  totalSpent: status === 'over' ? 1_100_000 : 800_000,
  budgetedSpent: status === 'over' ? 1_100_000 : 800_000,
  unbudgetedSpent: 0,
  totalRemaining: status === 'over' ? -100_000 : 200_000,
  budgetCount: 1,
  warningCount: status === 'warning' ? 1 : 0,
  overCount: status === 'over' ? 1 : 0,
  items: [{
    purposeId: 'p1',
    budgetId: 'b1',
    name: 'Sinh hoạt',
    nameEn: 'Family living',
    budget: 1_000_000,
    spent: status === 'over' ? 1_100_000 : 800_000,
    remaining: status === 'over' ? -100_000 : 200_000,
    usagePercent: status === 'over' ? 110 : 80,
    warningThreshold: 0.8,
    status,
  }],
});

describe('budget notification helpers', () => {
  beforeEach(() => window.localStorage.clear());

  it('tạo một cảnh báo duy nhất cho mục đích trong cùng tháng', () => {
    const first = syncBudgetNotifications('family-1', summary(), new Date('2026-09-10T00:00:00.000Z'));
    const second = syncBudgetNotifications('family-1', summary(), new Date('2026-09-10T00:05:00.000Z'));

    expect(first.newNotifications).toHaveLength(1);
    expect(second.newNotifications).toHaveLength(0);
    expect(second.notifications).toHaveLength(1);
    expect(second.notifications[0]!).toMatchObject({
      purposeId: 'p1',
      lastNotifiedKind: 'warning',
      readAt: null,
    });
  });

  it('đổi cảnh báo sang vượt ngân sách và phát thông báo mới một lần', () => {
    syncBudgetNotifications('family-1', summary(), new Date('2026-09-10T00:00:00.000Z'));
    const escalated = syncBudgetNotifications('family-1', summary('over'), new Date('2026-09-11T00:00:00.000Z'));
    const repeated = syncBudgetNotifications('family-1', summary('over'), new Date('2026-09-11T00:05:00.000Z'));

    expect(escalated.newNotifications).toHaveLength(1);
    expect(escalated.notifications[0]!).toMatchObject({ kind: 'over', readAt: null });
    expect(repeated.newNotifications).toHaveLength(0);
  });

  it('lưu trạng thái đã đọc theo family và không ảnh hưởng family khác', () => {
    syncBudgetNotifications('family-1', summary());
    syncBudgetNotifications('family-2', summary());
    const id = getBudgetNotifications('family-1')[0]!.id;

    markBudgetNotificationRead(id, new Date('2026-09-12T00:00:00.000Z'));
    expect(getBudgetNotifications('family-1')[0]!.readAt).toBe('2026-09-12T00:00:00.000Z');
    expect(getBudgetNotifications('family-2')[0]!.readAt).toBeNull();

    const familyOne = markAllBudgetNotificationsRead('family-1', new Date('2026-09-13T00:00:00.000Z'));
    expect(familyOne[0]!.readAt).toBe('2026-09-13T00:00:00.000Z');
    expect(getBudgetNotifications('family-2')[0]!.readAt).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { Transaction } from './domain';
import {
  deleteLocalRecurringExpense,
  generateLocalDueTransactions,
  getLocalDeletedRecurringExpenses,
  getLocalRecurringExpenses,
  nextRecurringDate,
  permanentlyDeleteLocalRecurringExpense,
  recurringForecastDates,
  recurringExpenseInputSchema,
  restoreLocalRecurringExpense,
  todayInVietnam,
  upsertLocalRecurringExpense,
} from './recurringExpense';

const template = {
  transactionType: 'Chi tiêu' as const,
  description: 'Tiền điện',
  amount: 300000,
  purposeId: 'purpose-1',
  expenseTypeId: 'expense-1',
  paymentMethodId: 'payment-1',
  note: null,
};

describe('quy tắc chi phí định kỳ', () => {
  beforeEach(() => window.localStorage.clear());

  it('tính kỳ tháng tiếp theo và giữ ngày neo khi tháng thiếu ngày', () => {
    expect(nextRecurringDate('2026-01-31', 'monthly', 31, 1)).toBe('2026-02-28');
    expect(nextRecurringDate('2026-02-28', 'monthly', 31, 1)).toBe('2026-03-31');
  });

  it('xử lý năm nhuận cho lịch hàng năm', () => {
    expect(nextRecurringDate('2028-02-29', 'yearly', 29, 2)).toBe('2029-02-28');
    expect(nextRecurringDate('2029-02-28', 'yearly', 29, 2)).toBe('2030-02-28');
  });

  it('lập dự báo các kỳ tiếp theo và dừng ở ngày kết thúc', () => {
    expect(recurringForecastDates('2026-01-31', 'monthly', 31, 1, '2026-03-31', 5)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('chặn mẫu thiếu dữ liệu hoặc có ngày kết thúc trước ngày chạy', () => {
    expect(recurringExpenseInputSchema.safeParse({
      name: '',
      template,
      frequency: 'monthly',
      nextRunDate: '2026-09-01',
      endDate: null,
    }).success).toBe(false);
    expect(recurringExpenseInputSchema.safeParse({
      name: 'Tiền điện',
      template,
      frequency: 'monthly',
      nextRunDate: '2026-09-10',
      endDate: '2026-09-01',
    }).success).toBe(false);
  });

  it('tự tạo các kỳ quá hạn thành giao dịch dự kiến và không tạo trùng', () => {
    const input = {
      name: 'Tiền điện',
      template,
      frequency: 'monthly' as const,
      nextRunDate: '2026-07-31',
      endDate: null,
    };
    upsertLocalRecurringExpense('family-1', input);
    const existing: Transaction[] = [];
    const first = generateLocalDueTransactions('family-1', 'user-1', existing, '2026-09-05');
    expect(first).toHaveLength(2);
    expect(first.every((item) => item.status === 'Dự kiến' && item.source === 'recurring')).toBe(true);
    expect(getLocalRecurringExpenses('family-1')[0]?.nextRunDate).toBe('2026-09-30');
    const second = generateLocalDueTransactions('family-1', 'user-1', [...existing, ...first], '2026-09-05');
    expect(second).toHaveLength(0);
  });

  it('giữ ngày neo khi chỉ sửa nội dung mẫu', () => {
    const input = {
      name: 'Tiền điện',
      template,
      frequency: 'monthly' as const,
      nextRunDate: '2026-02-28',
      endDate: null,
    };
    const first = upsertLocalRecurringExpense('family-1', input);
    expect(first.anchorDay).toBe(28);
    const edited = upsertLocalRecurringExpense('family-1', {
      ...input,
      name: 'Tiền điện tháng',
      template: { ...template, amount: 350000 },
    }, first.id);
    expect(edited.anchorDay).toBe(28);
    expect(nextRecurringDate(edited.nextRunDate, edited.frequency, edited.anchorDay, edited.anchorMonth)).toBe('2026-03-28');
  });

  it('xóa mềm mẫu và không sinh thêm kỳ mới, giữ giao dịch đã tạo', () => {
    const input = {
      name: 'Tiền điện',
      template,
      frequency: 'monthly' as const,
      nextRunDate: '2026-09-01',
      endDate: null,
    };
    const item = upsertLocalRecurringExpense('family-1', input);
    const created = generateLocalDueTransactions('family-1', 'user-1', [], '2026-09-05');

    deleteLocalRecurringExpense('family-1', item.id);

    expect(getLocalRecurringExpenses('family-1')).toHaveLength(0);
    expect(generateLocalDueTransactions('family-1', 'user-1', created, '2026-10-05')).toHaveLength(0);
    expect(created).toHaveLength(1);
    expect(created[0]?.sourceReference).toBe(`recurring:${item.id}:2026-09-01`);
  });

  it('khôi phục mẫu về trạng thái trước khi xóa và hỗ trợ xóa cứng', () => {
    const item = upsertLocalRecurringExpense('family-1', {
      name: 'Tiền điện',
      template,
      frequency: 'monthly',
      nextRunDate: '2026-09-01',
      endDate: null,
    });

    deleteLocalRecurringExpense('family-1', item.id);
    expect(getLocalDeletedRecurringExpenses('family-1')).toHaveLength(1);

    const restored = restoreLocalRecurringExpense('family-1', item.id);
    expect(restored.active).toBe(true);
    expect(restored.deletedAt).toBeNull();
    expect(getLocalRecurringExpenses('family-1')).toHaveLength(1);

    deleteLocalRecurringExpense('family-1', item.id);
    permanentlyDeleteLocalRecurringExpense('family-1', item.id);
    expect(getLocalRecurringExpenses('family-1')).toHaveLength(0);
    expect(getLocalDeletedRecurringExpenses('family-1')).toHaveLength(0);
  });

  it('trả ngày theo múi giờ Asia/Ho_Chi_Minh', () => {
    expect(todayInVietnam(new Date('2026-09-05T16:59:59.000Z'))).toBe('2026-09-05');
    expect(todayInVietnam(new Date('2026-09-05T17:00:00.000Z'))).toBe('2026-09-06');
  });
});

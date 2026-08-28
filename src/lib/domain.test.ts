import { describe, expect, it } from 'vitest';
import {
  canDeleteTransaction,
  findDuplicates,
  formatCompactVnd,
  formatVnd,
  getNetExpense,
  getTransactionTotalImpact,
  normalizeText,
  statusForTransactionDate,
  transactionSchema,
  type Transaction,
} from './domain';
describe('định dạng và quy tắc giao dịch', () => {
  it('định dạng VND không có số thập phân', () =>
    expect(formatVnd(1200000)).toMatch(/1[.\s]200[.\s]000\s₫/));
  it('viết gọn số tiền KPI theo K và M', () => {
    expect(formatCompactVnd(850000)).toBe('850K ₫');
    expect(formatCompactVnd(12500000)).toBe('12,5M ₫');
    expect(formatCompactVnd(-1200000)).toBe('-1,2M ₫');
  });
  it('tính ròng', () => {
    expect(getNetExpense(100, 'Chi tiêu')).toBe(100);
    expect(getNetExpense(100, 'Hoàn tiền')).toBe(-100);
    expect(getNetExpense(100, 'Thu nhập')).toBe(0);
  });
  it('tính tổng giao dịch với thu nhập và hoàn tiền là số trừ', () => {
    expect(getTransactionTotalImpact(100, 'Chi tiêu')).toBe(100);
    expect(getTransactionTotalImpact(100, 'Tạm ứng')).toBe(100);
    expect(getTransactionTotalImpact(100, 'Thu nhập')).toBe(-100);
    expect(getTransactionTotalImpact(100, 'Hoàn tiền')).toBe(-100);
  });
  it('tự chọn trạng thái theo ngày giao dịch', () => {
    expect(statusForTransactionDate('2026-08-27', '2026-08-26')).toBe(
      'Dự kiến',
    );
    expect(statusForTransactionDate('2026-08-26', '2026-08-26')).toBe(
      'Thực tế',
    );
    expect(statusForTransactionDate('2026-08-25', '2026-08-26')).toBe(
      'Thực tế',
    );
  });
  it('chặn số tiền không dương', () => {
    const base = {
      transactionDate: '2026-08-25',
      transactionType: 'Chi tiêu',
      status: 'Thực tế',
      description: 'Ăn trưa',
      purposeId: 'p',
      expenseTypeId: 'e',
      source: 'manual',
      aiGenerated: false,
    };
    expect(transactionSchema.safeParse({ ...base, amount: 0 }).success).toBe(
      false,
    );
    expect(transactionSchema.safeParse({ ...base, amount: -1 }).success).toBe(
      false,
    );
  });
  it('bắt buộc chọn phương thức thanh toán', () => {
    const result = transactionSchema.safeParse({
      transactionDate: '2026-08-25',
      transactionType: 'Chi tiêu',
      status: 'Thực tế',
      description: 'Ăn trưa',
      amount: 100000,
      purposeId: 'p',
      expenseTypeId: 'e',
      paymentMethodId: null,
      source: 'manual',
      aiGenerated: false,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toBe(
        'Vui lòng chọn phương thức thanh toán',
      );
  });
  it('phát hiện nội dung gần giống', () => {
    const t = {
      id: '1',
      transactionDate: '2026-08-25',
      amount: 450000,
      description: 'Mua sữa cho Haku',
      transactionType: 'Chi tiêu',
      status: 'Thực tế',
      purposeId: 'p',
      expenseTypeId: 'e',
      source: 'manual',
      aiGenerated: false,
    } satisfies Transaction;
    expect(
      findDuplicates({ ...t, description: 'mua sua cho Haku' }, [t]),
    ).toHaveLength(1);
  });
  it('chuẩn hóa tìm kiếm tiếng Việt không dấu, kể cả Đ viết hoa', () => {
    expect(normalizeText('Điện nước Đà Nẵng')).toBe('dien nuoc da nang');
    expect(normalizeText('CHUYỂN KHOẢN')).toBe('chuyen khoan');
  });
  it('chỉ cho member xóa giao dịch do chính mình tạo', () => {
    const transaction = {
      id: '1',
      transactionDate: '2026-08-26',
      amount: 100000,
      description: 'Ăn trưa',
      transactionType: 'Chi tiêu',
      status: 'Thực tế',
      purposeId: 'p',
      expenseTypeId: 'e',
      source: 'manual',
      aiGenerated: false,
      createdBy: 'member-a',
    } satisfies Transaction;
    expect(canDeleteTransaction(transaction, 'member', 'member-a')).toBe(true);
    expect(canDeleteTransaction(transaction, 'member', 'member-b')).toBe(false);
    expect(canDeleteTransaction(transaction, 'owner', 'owner')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { markTemplateDuplicates } from './templateDuplicates';
import type { TemplateRow } from './templateTypes';

const row = (overrides: Partial<TemplateRow> = {}): TemplateRow => ({
  id: '',
  rowNumber: 2,
  transactionDate: '2026-09-01',
  amount: 120000,
  transactionType: 'Chi tiêu',
  status: 'Thực tế',
  description: 'Mua thực phẩm',
  paymentMethodId: 'payment-1',
  purposeId: 'purpose-1',
  expenseTypeId: 'expense-1',
  note: '',
  duplicate: false,
  ...overrides,
});

describe('template duplicate matching', () => {
  it('đánh dấu giao dịch trùng từ remote theo ngày, số tiền và nội dung', () => {
    const result = markTemplateDuplicates(
      [row()],
      [{ transactionDate: '2026-09-01', amount: 120000, description: 'MUA  thực phẩm!' }],
    );

    expect(result[0]?.duplicate).toBe(true);
  });

  it('giữ duplicate trong file và bỏ qua giao dịch đã xóa mềm', () => {
    const result = markTemplateDuplicates(
      [row({ duplicate: true }), row({ rowNumber: 3, description: 'Giao dịch khác' })],
      [
        { transactionDate: '2026-09-01', amount: 120000, description: 'Mua thực phẩm', deletedAt: '2026-09-02T00:00:00Z' },
      ],
    );

    expect(result.map((item) => item.duplicate)).toEqual([true, false]);
  });
});

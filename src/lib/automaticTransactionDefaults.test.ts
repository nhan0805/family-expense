import { describe, expect, it } from 'vitest';
import {
  createSystemAutomaticTransactionDefaults,
  sanitizeAutomaticTransactionDefaults,
} from './automaticTransactionDefaults';

const catalogs = {
  purposes: [{ id: 'purpose-invest', name: 'Đầu tư' }, { id: 'purpose-other', name: 'Khác' }],
  expenseTypes: [
    { id: 'expense-opening', name: 'Gửi tiết kiệm' },
    { id: 'expense-interest', name: 'Lãi tiền gửi' },
    { id: 'expense-withdrawal', name: 'Rút tiết kiệm' },
    { id: 'expense-fee', name: 'Phí tiết kiệm' },
    { id: 'expense-settlement', name: 'Tất toán tiết kiệm' },
    { id: 'expense-gold', name: 'Đầu tư vàng' },
    { id: 'expense-other', name: 'Khác' },
  ],
  paymentMethods: [{ id: 'payment-transfer', name: 'Chuyển khoản' }, { id: 'payment-cash', name: 'Tiền mặt' }],
};

describe('mặc định giao dịch tự động', () => {
  it('giữ được danh mục riêng cho từng loại phát sinh', () => {
    const defaults = createSystemAutomaticTransactionDefaults(catalogs);
    expect(defaults.find((item) => item.automationKey === 'savings_interest')).toMatchObject({
      purposeId: 'purpose-invest',
      expenseTypeId: 'expense-interest',
      paymentMethodId: 'payment-cash',
    });
    expect(defaults.find((item) => item.automationKey === 'gold_sale')).toMatchObject({
      expenseTypeId: 'expense-gold',
      paymentMethodId: 'payment-cash',
    });
    expect(defaults.map((item) => item.automationKey)).toEqual([
      'savings_opening',
      'savings_interest',
      'savings_settlement',
      'gold_purchase',
      'gold_sale',
    ]);
  });

  it('loại bỏ id đã bị xóa khỏi cấu hình đã lưu và dùng lại mặc định hệ thống', () => {
    const sanitized = sanitizeAutomaticTransactionDefaults([
      {
        automationKey: 'gold_purchase',
        purposeId: 'deleted-purpose',
        expenseTypeId: 'deleted-expense',
        paymentMethodId: 'deleted-payment',
      },
    ], catalogs);
    expect(sanitized.find((item) => item.automationKey === 'gold_purchase')).toMatchObject({
      purposeId: 'purpose-invest',
      expenseTypeId: 'expense-gold',
      paymentMethodId: 'payment-transfer',
    });
    expect(sanitized).toHaveLength(5);
  });
});

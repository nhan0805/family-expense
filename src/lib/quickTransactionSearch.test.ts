import { describe, expect, it } from 'vitest';
import { getQuickTransactionSearch } from './quickTransactionSearch';

const catalog = {
  purposes: [{ id: 'purpose-1', name: 'Con cái' }],
  expenseTypes: [{ id: 'expense-1', name: 'Quần áo' }, { id: 'expense-2', name: 'Ăn uống' }],
  paymentMethods: [{ id: 'payment-1', name: 'Tiền mặt' }],
};

describe('quick transaction search', () => {
  it('bỏ qua Gemini cho câu chỉ gồm bộ lọc cấu trúc quen thuộc', () => {
    const response = getQuickTransactionSearch('mua quần áo tháng 9 năm 2026', 'vi', catalog);
    expect(response?.filters).toMatchObject({
      transactionType: 'Chi tiêu',
      expenseTypeIds: ['expense-1'],
      month: 9,
      year: 2026,
      query: '',
    });
  });

  it('để câu mơ hồ cho Gemini xử lý', () => {
    expect(getQuickTransactionSearch('mua quần áo ở cửa hàng gần nhà', 'vi', catalog)).toBeNull();
  });

  it('nhận diện nhanh câu lấy mọi chi tiêu trừ một mục đích', () => {
    const response = getQuickTransactionSearch('tất cả chi tiêu trừ khoản đầu tư', 'vi', {
      ...catalog,
      purposes: [{ id: 'purpose-investment', name: 'Đầu tư' }, ...catalog.purposes],
    });
    expect(response?.filters).toMatchObject({
      transactionType: 'Chi tiêu',
      purposeIds: [],
      expenseTypeIds: [],
      excludePurposeIds: ['purpose-investment'],
      query: '',
    });
  });
});

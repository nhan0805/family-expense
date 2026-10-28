import { afterEach, describe, expect, it } from 'vitest';
import { readLocalDemoMembers, readLocalDemoState, saveLocalDemoMembers, saveLocalDemoState } from './localDemoStorage';

const transaction = {
  id: 'local-transaction-1',
  familyId: 'local-family',
  transactionDate: '2026-08-25',
  transactionType: 'Chi tiêu' as const,
  status: 'Thực tế' as const,
  description: 'Ăn trưa',
  amount: 100000,
  purposeId: 'purpose-1',
  expenseTypeId: 'expense-1',
  paymentMethodId: 'payment-1',
  note: null,
  source: 'manual' as const,
  sourceReference: null,
  aiGenerated: false,
};

describe('local demo storage', () => {
  afterEach(() => localStorage.clear());

  it('lưu và đọc lại dữ liệu demo theo family', () => {
    saveLocalDemoState('local-family', {
      familyName: 'Nhà mình',
      purposes: [{ id: 'purpose-1', name: 'Sinh hoạt' }],
      expenseTypes: [{ id: 'expense-1', name: 'Ăn uống' }],
      paymentMethods: [{ id: 'payment-1', name: 'Tiền mặt' }],
      transactions: [transaction],
    });

    expect(readLocalDemoState('local-family')).toMatchObject({
      familyName: 'Nhà mình',
      purposes: [{ id: 'purpose-1', name: 'Sinh hoạt' }],
      transactions: [transaction],
    });
  });

  it('bỏ qua JSON thành viên không hợp lệ thay vì đưa vào state', () => {
    localStorage.setItem('family-expense:demo-members:local-family', JSON.stringify([{ id: 'bad' }]));
    expect(readLocalDemoMembers('local-family')).toEqual([]);
    expect(saveLocalDemoMembers('local-family', [{
      id: 'local',
      user_id: 'local-user',
      display_name: 'Chủ gia đình',
      email: 'demo@family.local',
      role: 'owner',
      status: 'active',
      created_at: '2026-08-25T00:00:00Z',
    }])).toBe(true);
    expect(readLocalDemoMembers('local-family')).toHaveLength(1);
  });
});

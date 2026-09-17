import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

import {
  fetchAutomaticTransactionDefaults,
  saveAutomaticTransactionDefaults,
  automaticTransactionDefaultsStorageKey,
} from './automaticTransactionDefaultsApi';

const defaults = [
  { automationKey: 'savings_opening' as const, purposeId: 'p', expenseTypeId: 'e', paymentMethodId: 'm' },
  { automationKey: 'savings_interest' as const, purposeId: 'p', expenseTypeId: 'e', paymentMethodId: 'm' },
  { automationKey: 'savings_settlement' as const, purposeId: 'p', expenseTypeId: 'e', paymentMethodId: 'm' },
  { automationKey: 'gold_purchase' as const, purposeId: 'p', expenseTypeId: 'e', paymentMethodId: 'm' },
  { automationKey: 'gold_sale' as const, purposeId: 'p', expenseTypeId: 'e', paymentMethodId: 'm' },
];

describe('lưu cấu hình giao dịch tự động ở chế độ local', () => {
  afterEach(() => localStorage.clear());

  it('lưu và đọc cấu hình theo family', async () => {
    await saveAutomaticTransactionDefaults('family-1', defaults);
    expect(localStorage.getItem(automaticTransactionDefaultsStorageKey('family-1'))).toContain('gold_sale');
    await expect(fetchAutomaticTransactionDefaults('family-1')).resolves.toEqual(defaults);
  });
});

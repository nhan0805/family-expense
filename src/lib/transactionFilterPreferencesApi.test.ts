import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSystemTransactionFilterPreset } from './transactionFilters';

vi.mock('./supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

import {
  clearTransactionFilterPreference,
  fetchTransactionFilterPreference,
  saveTransactionFilterPreference,
  transactionFilterPreferenceKey,
} from './transactionFilterPreferencesApi';

describe('lưu bộ lọc giao dịch ở chế độ local', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('lưu, đọc và xóa preference theo family và user', async () => {
    const preference = createSystemTransactionFilterPreset([{ id: 'p1', name: 'Đầu tư' }]);
    preference.period = 'all-time';
    await saveTransactionFilterPreference('family-1', 'user-1', preference);
    expect(localStorage.getItem(transactionFilterPreferenceKey('family-1', 'user-1'))).toContain('all-time');
    await expect(fetchTransactionFilterPreference('family-1', 'user-1')).resolves.toMatchObject({ period: 'all-time' });
    await clearTransactionFilterPreference('family-1', 'user-1');
    await expect(fetchTransactionFilterPreference('family-1', 'user-1')).resolves.toBeNull();
  });
});

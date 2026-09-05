import { afterEach, describe, expect, it } from 'vitest';
import {
  clearTransactionDraft,
  readTransactionDraft,
  saveTransactionDraft,
  transactionDraftKey,
} from './transactionDraft';

describe('bản nháp giao dịch', () => {
  afterEach(() => {
    clearTransactionDraft('family-a');
    clearTransactionDraft('f1');
    clearTransactionDraft('family-a', 'transaction-1');
  });

  it('lưu, đọc và xóa bản nháp theo family', () => {
    const values = { description: 'Mua sữa', amount: 450000 };
    saveTransactionDraft('family-a', values);
    expect(localStorage.getItem(transactionDraftKey('family-b'))).toBeNull();
    expect(readTransactionDraft('family-a')).toEqual(values);
    clearTransactionDraft('family-a');
    expect(readTransactionDraft('family-a')).toBeNull();
  });

  it('bỏ qua dữ liệu localStorage không hợp lệ', () => {
    localStorage.setItem(transactionDraftKey('family-a'), '{bad json');
    expect(readTransactionDraft('family-a')).toBeNull();
  });

  it('tách bản nháp chỉnh sửa theo giao dịch', () => {
    saveTransactionDraft('family-a', { description: 'Mua sữa' }, 'transaction-1');
    expect(readTransactionDraft('family-a')).toEqual(null);
    expect(readTransactionDraft('family-a', 'transaction-1')).toEqual({ description: 'Mua sữa' });
    expect(localStorage.getItem(transactionDraftKey('family-a', 'transaction-1'))).toContain('Mua sữa');
  });
});

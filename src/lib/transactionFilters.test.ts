import { describe, expect, it } from 'vitest';
import {
  createSystemTransactionFilterPreset,
  getVietnamCurrentPeriod,
  hasExplicitTransactionFilterParams,
  resolveTransactionFilterPreset,
  sanitizeTransactionFilterPreset,
  transactionFilterPresetSchema,
} from './transactionFilters';

describe('bộ lọc giao dịch mặc định', () => {
  it('tính đúng tháng Việt Nam khi ngày UTC rơi vào ngày đầu tháng mới', () => {
    expect(getVietnamCurrentPeriod(new Date('2026-08-31T17:00:00Z'))).toEqual({ month: '09', year: '2026' });
  });

  it('giữ mặc định chi tiêu thực tế và loại trừ Đầu tư', () => {
    expect(createSystemTransactionFilterPreset([
      { id: 'p1', name: 'Sinh hoạt' },
      { id: 'p2', name: 'Đầu tư' },
    ])).toMatchObject({
      transactionType: 'Chi tiêu',
      status: 'Thực tế',
      period: 'current-month',
      excludePurposeIds: ['p2'],
    });
  });

  it('chuyển preset tương đối thành bộ lọc dùng cho danh sách', () => {
    const preset = createSystemTransactionFilterPreset([]);
    expect(resolveTransactionFilterPreset(preset, new Date('2026-09-16T00:00:00Z'))).toMatchObject({
      month: '09',
      year: '2026',
      dateFrom: '',
      dateTo: '',
    });
    expect(resolveTransactionFilterPreset({ ...preset, period: 'current-year' }, new Date('2026-09-16T00:00:00Z'))).toMatchObject({ month: '', year: '2026' });
    expect(resolveTransactionFilterPreset({ ...preset, period: 'all-time' }, new Date('2026-09-16T00:00:00Z'))).toMatchObject({ month: '', year: '' });
  });

  it('loại ID danh mục không còn tồn tại trước khi áp dụng preset', () => {
    const sanitized = sanitizeTransactionFilterPreset({
      ...createSystemTransactionFilterPreset([]),
      purposeIds: ['p1', 'deleted-purpose'],
      excludePurposeIds: ['p2'],
    }, {
      purposes: [{ id: 'p1', name: 'Sinh hoạt' }],
      expenseTypes: [],
      paymentMethods: [],
    });
    expect(sanitized?.purposeIds).toEqual(['p1']);
    expect(sanitized?.excludePurposeIds).toEqual([]);
  });

  it('nhận diện đường dẫn có bộ lọc rõ ràng', () => {
    expect(hasExplicitTransactionFilterParams(new URLSearchParams('month=09'))).toBe(true);
    expect(hasExplicitTransactionFilterParams(new URLSearchParams())).toBe(false);
  });

  it('từ chối khoảng tiền ngược chiều', () => {
    expect(transactionFilterPresetSchema.safeParse({
      ...createSystemTransactionFilterPreset([]),
      amountMin: '900000',
      amountMax: '100000',
    }).success).toBe(false);
  });
});

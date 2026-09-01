import { describe, expect, it } from 'vitest';
import type { Transaction } from '../lib/domain';
import {
  compareTransactions,
  formatAmountFilterInput,
  filterAndSortTransactions,
  getInitialTransactionPeriod,
  getInitialTransactionType,
  getTransactionListTone,
  normalizeAmountFilterInput,
} from './Transactions';

const transaction = (id: string, transactionDate: string): Transaction => ({
  id,
  transactionDate,
  transactionType: 'Chi tiêu',
  status: 'Thực tế',
  description: id,
  amount: 1,
  purposeId: 'p',
  expenseTypeId: 'e',
  source: 'manual',
  aiGenerated: false,
});

describe('sắp xếp giao dịch theo ngày', () => {
  it('đọc đúng bộ lọc loại giao dịch từ URL KPI', () => {
    expect(getInitialTransactionType('Chi tiêu')).toBe('Chi tiêu');
    expect(getInitialTransactionType('Thu nhập')).toBe('Thu nhập');
    expect(getInitialTransactionType('không hợp lệ')).toBe('');
  });
  it('mặc định lọc theo tháng và năm hiện tại khi URL không truyền kỳ', () => {
    expect(
      getInitialTransactionPeriod(null, null, new Date(2026, 7, 26)),
    ).toEqual({ month: '08', year: '2026' });
  });

  it('ưu tiên kỳ hợp lệ được truyền từ URL', () => {
    expect(
      getInitialTransactionPeriod('02', '2025', new Date(2026, 7, 26)),
    ).toEqual({ month: '02', year: '2025' });
    expect(
      getInitialTransactionPeriod('2024-11', null, new Date(2026, 7, 26)),
    ).toEqual({ month: '11', year: '2024' });
  });

  it('dùng màu riêng cho hai loại giao dịch trong danh sách', () => {
    expect(getTransactionListTone('Thu nhập').amountClass).toContain('emerald');
    expect(getTransactionListTone('Thu nhập').amountClass).toContain('dark:text-[#50fa7b]');
    expect(getTransactionListTone('Chi tiêu').amountClass).toContain('rose');
    expect(getTransactionListTone('Chi tiêu').amountClass).toContain('dark:text-[#ff79c6]');
    for (const type of ['Thu nhập', 'Chi tiêu'] as const) {
      const tone = getTransactionListTone(type);
      expect(tone.rowClass).toContain('bg-gradient-to-r');
      expect(tone.rowClass).not.toContain('border-l-');
      expect(tone.badgeClass).toContain('border');
      expect(tone.badgeClass).toContain('shadow-sm');
      expect(tone.rowClass).toContain('dark:');
    }
  });

  it('đặt năm 2023 và 2024 trước năm 2025 khi chọn ngày cũ nhất', () => {
    const rows = [
      transaction('bach-hoa-xanh', '2025-10-30'),
      transaction('tivi', '2023-12-31'),
      transaction('dien', '2024-01-01'),
    ];
    expect(
      rows.sort(compareTransactions('date-asc')).map((item) => item.id),
    ).toEqual(['tivi', 'dien', 'bach-hoa-xanh']);
  });

  it('đưa ngày không hợp lệ xuống cuối danh sách', () => {
    const rows = [
      transaction('loi', 'khong-hop-le'),
      transaction('hop-le', '2024-01-01'),
    ];
    expect(
      rows.sort(compareTransactions('date-asc')).map((item) => item.id),
    ).toEqual(['hop-le', 'loi']);
  });

  it('không giữ dòng Thực phẩm khi lọc Nước và sắp xếp số tiền cao nhất', () => {
    const food = {
      ...transaction('bach-hoa-xanh', '2025-10-30'),
      amount: 54000,
      expenseTypeId: 'thuc-pham',
      purposeId: 'sinh-hoat',
    };
    const waterHigh = {
      ...transaction('dien-luc', '2024-04-26'),
      amount: 591479,
      expenseTypeId: 'nuoc',
      purposeId: 'sinh-hoat',
    };
    const waterLow = {
      ...transaction('tien-nuoc', '2025-04-14'),
      amount: 462000,
      expenseTypeId: 'nuoc',
      purposeId: 'sinh-hoat',
    };
    const rows = filterAndSortTransactions([food, waterLow, waterHigh], {
      query: '',
      transactionType: '',
      status: 'Thực tế',
      purposeId: 'sinh-hoat',
      expenseTypeId: 'nuoc',
      paymentMethodId: '',
      amountMin: '',
      amountMax: '',
      month: '',
      year: '',
      dateFrom: '',
      dateTo: '',
      sort: 'amount-desc',
    });
    expect(rows.map((item) => item.id)).toEqual(['dien-luc', 'tien-nuoc']);
  });

  it('lọc độc lập theo tháng và năm', () => {
    const rows = [
      transaction('thang-1-2025', '2025-01-10'),
      transaction('thang-2-2025', '2025-02-10'),
      transaction('thang-2-2026', '2026-02-10'),
    ];
    const filters = {
      query: '', transactionType: '', status: '', purposeId: '', expenseTypeId: '', paymentMethodId: '', amountMin: '', amountMax: '',
      month: '02', year: '2025', dateFrom: '', dateTo: '', sort: 'date-desc' as const,
    };
    expect(filterAndSortTransactions(rows, filters).map((item) => item.id)).toEqual(['thang-2-2025']);
    expect(filterAndSortTransactions(rows, { ...filters, month: '' }).map((item) => item.id)).toEqual(['thang-2-2025', 'thang-1-2025']);
  });
  it('tìm nội dung có dấu bằng từ khóa không dấu', () => {
    const rows = [
      { ...transaction('dien-nuoc', '2026-08-10'), description: 'Điện nước Đà Nẵng' },
      { ...transaction('an-trua', '2026-08-11'), description: 'Ăn trưa' },
    ];
    const filters = {
      query: 'dien nuoc da nang', transactionType: '', status: '', purposeId: '', expenseTypeId: '', paymentMethodId: '', amountMin: '', amountMax: '',
      month: '', year: '', dateFrom: '', dateTo: '', sort: 'date-desc' as const,
    };
    expect(filterAndSortTransactions(rows, filters).map((item) => item.id)).toEqual(['dien-nuoc']);
  });
  it('lọc theo khoảng số tiền', () => {
    const rows = [
      { ...transaction('small', '2026-08-10'), amount: 100000 },
      { ...transaction('middle', '2026-08-11'), amount: 500000 },
      { ...transaction('large', '2026-08-12'), amount: 2000000 },
    ];
    const filters = {
      query: '', transactionType: '', status: '', purposeId: '', expenseTypeId: '', paymentMethodId: '', amountMin: '500000', amountMax: '1500000',
      month: '', year: '', dateFrom: '', dateTo: '', sort: 'date-desc' as const,
    };
    expect(filterAndSortTransactions(rows, filters).map((item) => item.id)).toEqual(['middle']);
  });

  it('định dạng số tiền lọc theo phân cách hàng nghìn và giữ dữ liệu số nguyên', () => {
    expect(normalizeAmountFilterInput('1.234.567 đ')).toBe('1234567');
    expect(formatAmountFilterInput('0001234567')).toBe('1.234.567');
    expect(formatAmountFilterInput('')).toBe('');
  });
});

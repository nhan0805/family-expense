import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExpenseWorkbook } from './importExcel';

describe('import Excel', () => {
  it('đọc sheet chuẩn hóa với hai loại giao dịch hiện hành', () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Mã giao dịch': 'TXN-1', Ngày: '2026-08-25', 'Loại giao dịch': 'Chi tiêu',
        'Trạng thái': 'Thực tế', 'Nội dung': 'Ăn', 'Số tiền': 100,
        'Mục đích chi': 'Sinh hoạt gia đình', 'Loại chi phí': 'Ăn uống',
        'Sự kiện/Kế hoạch': 'Legacy event', 'Tài khoản/Thẻ': 'Legacy account',
      },
      {
        'Mã giao dịch': 'TXN-2', Ngày: '2026-08-25', 'Loại giao dịch': 'Thu nhập',
        'Trạng thái': 'Thực tế', 'Nội dung': 'Lương', 'Số tiền': 20,
        'Mục đích chi': 'Khác', 'Loại chi phí': 'Khác',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Giao dịch chuẩn hóa');
    const result = parseExpenseWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(result.valid).toHaveLength(2);
    expect(result.totalNet).toBe(100);
    expect(result.valid[0]).not.toHaveProperty('event');
    expect(result.valid[0]).not.toHaveProperty('account');
  });
});

import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { createTemplate, inferImportMode, parseTemplate, templateHeaders } from './templateImport';
const purposes = [{ id: 'p1', name: 'Sinh hoạt' }],
  types = [{ id: 'e1', name: 'Ăn uống' }],
  methods = [{ id: 'm1', name: 'Chuyển khoản' }];
describe('template import', () => {
  it('tự nhận diện thêm mới và cập nhật theo ID', () => {
    expect(inferImportMode([{ id: '' }])).toBe('insert');
    expect(inferImportMode([{ id: '11111111-1111-4111-8111-111111111111' }])).toBe('update');
    expect(inferImportMode([{ id: '11111111-1111-4111-8111-111111111111' }, { id: '' }])).toBe('insert');
  });

  it('tạo template có validation và đọc dòng hợp lệ', async () => {
    const buffer = await createTemplate(purposes, types, methods);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Giao dịch')!;
    expect(ws.getCell('C2').dataValidation.type).toBe('list');
    ['2026-08-26', 100000, 'Tiền ra', 'Thực tế', 'Ăn trưa', 'Chuyển khoản', 'Sinh hoạt', 'Ăn uống', ''].forEach((value, index) => {
      ws.getCell(2, index + 1).value = value;
    });
    const edited = await wb.xlsx.writeBuffer();
    const result = await parseTemplate(edited, purposes, types, methods, []);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]?.purposeId).toBe('p1');
  });

  it('đọc ngày serial và file xuất rút gọn theo tên cột', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Ngày', 'Loại giao dịch', 'Trạng thái', 'Nội dung', 'Số tiền', 'Mục đích', 'Danh mục', 'Phương thức thanh toán', 'Ghi chú', 'Nguồn'],
      [45316, 'Tiền vào', 'Thực tế', 'Salary', 57683000, 'Sinh hoạt', 'Ăn uống', 'Chuyển khoản', '', 'manual'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Giao dịch');
    const result = await parseTemplate(
      XLSX.write(wb, { type: 'array', bookType: 'xlsx' }),
      purposes,
      types,
      methods,
      [],
    );
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      transactionDate: '2024-01-25',
      transactionType: 'Thu nhập',
      amount: 57683000,
    });
  });

  it('đọc ID giao dịch để phục vụ cập nhật', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [...templateHeaders],
      ['2026-08-26', 100000, 'Tiền ra', 'Thực tế', 'Ăn trưa', 'Chuyển khoản', 'Sinh hoạt', 'Ăn uống', '', '11111111-1111-4111-8111-111111111111'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Giao dịch');
    const result = await parseTemplate(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), purposes, types, methods, []);
    expect(result.valid[0]?.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.valid[0]?.duplicate).toBe(false);
  });
});

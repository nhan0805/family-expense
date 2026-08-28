import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createTemplate, parseTemplate } from './templateImport';
const purposes = [{ id: 'p1', name: 'Sinh hoạt' }],
  types = [{ id: 'e1', name: 'Ăn uống' }],
  methods = [{ id: 'm1', name: 'Chuyển khoản' }];
describe('template import', () => {
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
});

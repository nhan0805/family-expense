import { z } from 'zod';
import * as XLSX from 'xlsx';
import {
  statuses,
  getCatalogDisplayName,
  normalizeText,
  type CatalogItem,
  type CatalogLanguage,
  type Transaction,
} from './domain';
import type {
  TemplateError,
  TemplateRow,
} from './templateTypes';
export { inferImportMode } from './templateTypes';
export type { ImportMode, TemplateError, TemplateRow } from './templateTypes';
const templateTransactionTypes = ['Tiền ra', 'Tiền vào'] as const;

export const templateHeaders = [
  'Ngày',
  'Số tiền (VND)',
  'Loại giao dịch',
  'Trạng thái',
  'Nội dung',
  'Phương thức thanh toán',
  'Mục đích',
  'Danh mục',
  'Ghi chú',
  'ID giao dịch',
] as const;
const schema = z.object({
  id: z.string().uuid().or(z.literal('')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int().positive(),
  type: z.enum(templateTransactionTypes),
  status: z.enum(statuses),
  description: z.string().trim().min(1).max(500),
  payment: z.string().min(1),
  purpose: z.string().min(1),
  expense: z.string().min(1),
  note: z.string().max(2000),
});
const norm = (v: unknown) => String(v ?? '').trim();
const dateValue = (v: unknown) =>
  v instanceof Date
    ? v.toISOString().slice(0, 10)
    : typeof v === 'number' && Number.isFinite(v)
      ? new Date(Date.UTC(1899, 11, 30 + v)).toISOString().slice(0, 10)
    : norm(v).match(/^\d{4}-\d{2}-\d{2}/)?.[0] ||
      norm(v).split('/').reverse().join('-');

export async function createTemplate(
  purposes: CatalogItem[],
  expenseTypes: CatalogItem[],
  paymentMethods: CatalogItem[],
  language: CatalogLanguage = 'vi',
) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Giao dịch', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const lists = wb.addWorksheet('Danh mục');
  const guide = wb.addWorksheet('Hướng dẫn');
  ws.addRow([...templateHeaders]);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF155E46' },
  };
  ws.autoFilter = 'A1:I1001';
  ws.columns = [14, 18, 20, 16, 36, 26, 28, 26, 36, 38].map((width) => ({ width }));
  lists.addRow([
    'Loại giao dịch',
    'Trạng thái',
    'Phương thức thanh toán',
    'Mục đích',
    'Danh mục',
  ]);
  const max = Math.max(
    templateTransactionTypes.length,
    statuses.length,
    paymentMethods.length,
    purposes.length,
    expenseTypes.length,
  );
  for (let i = 0; i < max; i++)
    lists.addRow([
      templateTransactionTypes[i] || '',
      statuses[i] || '',
      getCatalogDisplayName(paymentMethods[i], language),
      getCatalogDisplayName(purposes[i], language),
      getCatalogDisplayName(expenseTypes[i], language),
    ]);
  lists.state = 'veryHidden';
  guide.addRows([
    ['HƯỚNG DẪN IMPORT'],
    ['Mỗi dòng là một giao dịch; không đổi tên sheet hoặc tiêu đề.'],
    ['ID giao dịch chỉ điền khi muốn cập nhật giao dịch hiện có. Không sửa ID.'],
    ['Số tiền là số nguyên dương, không nhập ký hiệu đ.'],
    ['Chọn các giá trị danh mục từ dropdown.'],
    ['Tối đa 1.000 dòng mỗi file.'],
  ]);
  guide.getColumn(1).width = 90;
  guide.getRow(1).font = { bold: true, size: 16 };
  for (let row = 2; row <= 1001; row++) {
    ws.getCell(`A${row}`).numFmt = 'dd/mm/yyyy';
    ws.getCell(`A${row}`).dataValidation = {
      type: 'date',
      operator: 'between',
      formulae: [new Date(2000, 0, 1), new Date(2200, 11, 31)],
      showErrorMessage: true,
      error: 'Ngày không hợp lệ',
    };
    ws.getCell(`B${row}`).numFmt = '#,##0';
    ws.getCell(`B${row}`).dataValidation = {
      type: 'whole',
      operator: 'greaterThan',
      formulae: [0],
      showErrorMessage: true,
      error: 'Số tiền phải là số nguyên lớn hơn 0',
    };
    [
      ['C', 1, templateTransactionTypes.length],
      ['D', 2, statuses.length],
      ['F', 3, paymentMethods.length],
      ['G', 4, purposes.length],
      ['H', 5, expenseTypes.length],
    ].forEach(([col, index, count]) => {
      ws.getCell(`${col}${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [
          `'Danh mục'!$${String.fromCharCode(64 + Number(index))}$2:$${String.fromCharCode(64 + Number(index))}$${Number(count) + 1}`,
        ],
        showErrorMessage: true,
        error: 'Hãy chọn giá trị trong danh sách',
      };
    });
  }
  return wb.xlsx.writeBuffer();
}

export async function parseTemplate(
  buffer: ArrayBuffer,
  purposes: CatalogItem[],
  expenseTypes: CatalogItem[],
  paymentMethods: CatalogItem[],
  transactions: Transaction[],
) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets['Giao dịch'];
  if (!ws) throw new Error('Không tìm thấy sheet “Giao dịch”.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: '',
  });
  const header = rows[0] || [];
  const headerIndex = (name: string) => {
    const index = header.findIndex((value) => norm(value) === name);
    return index;
  };
  const isTemplate = templateHeaders.every(
    (name, index) => norm(header[index]) === name,
  );
  const exportHeaders = [
    'Ngày',
    'Loại giao dịch',
    'Trạng thái',
    'Nội dung',
    'Số tiền',
    'Phương thức thanh toán',
    'Mục đích',
    'Danh mục',
  ];
  const isFullExport = !isTemplate && exportHeaders.every((name) => headerIndex(name) >= 0);
  if (!isTemplate && !isFullExport)
    throw new Error('Tiêu đề cột không đúng template.');
  const valid: TemplateRow[] = [];
  const errors: TemplateError[] = [];
  const lookup = (items: CatalogItem[], name: string) =>
    items.find(
      (x) => [x.name, x.nameEn].some((candidate) => candidate ? normalizeText(candidate) === normalizeText(name) : false),
    )?.id;
  rows.slice(1).forEach((values, index) => {
    const n = index + 2;
    if (values.every((v) => norm(v) === '')) return;
    const value = (name: string, templatePosition: number) =>
      values[isFullExport ? headerIndex(name) : templatePosition];
    const raw = {
      id: norm(value('ID giao dịch', isFullExport ? -1 : 9)),
      date: dateValue(value('Ngày', isFullExport ? 0 : 0)),
      amount: Number(value(isFullExport ? 'Số tiền' : 'Số tiền (VND)', isFullExport ? 4 : 1)),
      type: norm(value('Loại giao dịch', isFullExport ? 1 : 2)),
      status: norm(value('Trạng thái', isFullExport ? 2 : 3)),
      description: norm(value('Nội dung', isFullExport ? 3 : 4)),
      payment: norm(value('Phương thức thanh toán', isFullExport ? 5 : 5)),
      purpose: norm(value('Mục đích', isFullExport ? 6 : 6)),
      expense: norm(value('Danh mục', isFullExport ? 7 : 7)),
      note: norm(value('Ghi chú', isFullExport ? 8 : 8)),
    };
    const parsed = schema.safeParse(raw);
    const messages = parsed.success
      ? []
      : parsed.error.issues.map((i) => String(i.path[0]) + ': ' + i.message);
    const paymentMethodId = lookup(paymentMethods, raw.payment),
      purposeId = lookup(purposes, raw.purpose),
      expenseTypeId = lookup(expenseTypes, raw.expense);
    if (!paymentMethodId) messages.push('Phương thức thanh toán không tồn tại');
    if (!purposeId) messages.push('Mục đích không tồn tại');
    if (!expenseTypeId) messages.push('Danh mục không tồn tại');
    if (messages.length) {
      errors.push({ rowNumber: n, messages });
      return;
    }
    const duplicate = !raw.id && transactions.some(
      (t) =>
        !t.deletedAt &&
        t.transactionDate === raw.date &&
        t.amount === raw.amount &&
        t.description.trim().toLocaleLowerCase('vi-VN') ===
          raw.description.toLocaleLowerCase('vi-VN'),
    );
    valid.push({
      id: raw.id,
      rowNumber: n,
      transactionDate: raw.date,
      amount: raw.amount,
      transactionType: (raw.type === 'Tiền ra' ? 'Chi tiêu' : 'Thu nhập') as TemplateRow['transactionType'],
      status: raw.status as TemplateRow['status'],
      description: raw.description,
      paymentMethodId: paymentMethodId!,
      purposeId: purposeId!,
      expenseTypeId: expenseTypeId!,
      note: raw.note,
      duplicate,
    });
  });
  return { valid, errors };
}

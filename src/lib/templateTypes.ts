import type { TransactionType } from './domain';

export type TemplateRow = {
  id: string;
  rowNumber: number;
  transactionDate: string;
  amount: number;
  transactionType: TransactionType;
  status: 'Thực tế' | 'Dự kiến';
  description: string;
  paymentMethodId: string;
  purposeId: string;
  expenseTypeId: string;
  note: string;
  duplicate: boolean;
};

export type TemplateError = { rowNumber: number; messages: string[] };
export type ImportMode = 'insert' | 'update';

export function inferImportMode(rows: Array<Pick<TemplateRow, 'id'>>): ImportMode {
  return rows.length > 0 && rows.every((row) => Boolean(row.id))
    ? 'update'
    : 'insert';
}

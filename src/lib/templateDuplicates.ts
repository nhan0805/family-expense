import { normalizeText, type Transaction } from './domain';
import type { TemplateRow } from './templateTypes';

export const templateDuplicateKey = (date: string, amount: number, description: string) =>
  `${date}|${amount}|${normalizeText(description)}`;

export function markTemplateDuplicates(
  rows: TemplateRow[],
  transactions: Array<Pick<Transaction, 'transactionDate' | 'amount' | 'description' | 'deletedAt'>>,
) {
  const duplicateKeys = new Set(
    transactions
      .filter((transaction) => !transaction.deletedAt)
      .map((transaction) => templateDuplicateKey(transaction.transactionDate, transaction.amount, transaction.description)),
  );
  return rows.map((row) => ({
    ...row,
    duplicate: row.duplicate || (!row.id && duplicateKeys.has(templateDuplicateKey(row.transactionDate, row.amount, row.description))),
  }));
}

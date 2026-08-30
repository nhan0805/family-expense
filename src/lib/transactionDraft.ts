import { z } from 'zod';
import { statuses, transactionTypes, type TransactionFormInput } from './domain';

const draftSchema = z.object({
  transactionDate: z.string().optional(),
  transactionType: z.enum(transactionTypes).optional(),
  status: z.enum(statuses).optional(),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  purposeId: z.string().optional(),
  expenseTypeId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  eventId: z.string().nullable().optional(),
  beneficiaryId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  source: z.enum(['manual', 'ai', 'excel_import']).optional(),
  sourceReference: z.string().nullable().optional(),
  aiGenerated: z.boolean().optional(),
});

export const transactionDraftKey = (familyId: string) =>
  `family-expense:transaction-draft:${familyId}`;

export function saveTransactionDraft(
  familyId: string,
  values: Partial<TransactionFormInput>,
) {
  try {
    localStorage.setItem(transactionDraftKey(familyId), JSON.stringify(values));
  } catch {
    // Storage có thể bị khóa ở chế độ riêng tư; không làm hỏng luồng nhập liệu.
  }
}

export function readTransactionDraft(familyId: string) {
  try {
    const raw = localStorage.getItem(transactionDraftKey(familyId));
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearTransactionDraft(familyId: string) {
  try {
    localStorage.removeItem(transactionDraftKey(familyId));
  } catch {
    // Không chặn điều hướng sau khi giao dịch đã lưu thành công.
  }
}

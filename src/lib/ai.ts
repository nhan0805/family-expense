import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const aiSuggestionSchema = z.object({
  date: isoDateSchema,
  description: z.string().min(1),
  amount: z.number().positive().nullable(),
  transactionType: z.enum(['Chi tiêu', 'Thu nhập']),
  status: z.enum(['Thực tế', 'Dự kiến']),
  purposeId: z.string().nullable(),
  purposeName: z.string().nullable(),
  expenseTypeId: z.string().nullable(),
  expenseTypeName: z.string().nullable(),
  paymentMethodId: z.string().nullable(),
  paymentMethodName: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

export const aiResponseSchema = z.object({ suggestion: aiSuggestionSchema });
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export const transactionSearchFiltersSchema = z.object({
  query: z.string().max(240),
  transactionType: z.enum(['Chi tiêu', 'Thu nhập']).nullable(),
  status: z.enum(['Thực tế', 'Dự kiến']).nullable(),
  purposeIds: z.array(z.string().uuid()).max(20),
  expenseTypeIds: z.array(z.string().uuid()).max(20),
  paymentMethodIds: z.array(z.string().uuid()).max(20),
  amountMin: z.number().nonnegative().nullable(),
  amountMax: z.number().nonnegative().nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  year: z.number().int().min(2000).max(2200).nullable(),
  dateFrom: isoDateSchema.nullable(),
  dateTo: isoDateSchema.nullable(),
  sort: z.enum([
    'date-desc',
    'date-asc',
    'amount-desc',
    'amount-asc',
    'description-asc',
  ]),
});

export const transactionSearchResponseSchema = z.object({
  filters: transactionSearchFiltersSchema,
  explanation: z.string().max(240),
});
export type TransactionSearchResponse = z.infer<
  typeof transactionSearchResponseSchema
>;

export const dashboardSummaryResponseSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  highlights: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type DashboardSummaryResponse = z.infer<
  typeof dashboardSummaryResponseSchema
>;

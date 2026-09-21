import { z } from 'zod';
import {
  normalizeText,
  type CatalogItem,
  type TransactionType,
} from './domain';

export const transactionFilterSortValues = [
  'date-desc',
  'date-asc',
  'amount-desc',
  'amount-asc',
  'description-asc',
] as const;
export type TransactionFilterSort = (typeof transactionFilterSortValues)[number];

export const transactionFilterPeriodValues = [
  'current-month',
  'current-year',
  'all-time',
  'custom',
] as const;
export type TransactionFilterPeriod = (typeof transactionFilterPeriodValues)[number];

const filterIdSchema = z.array(z.string().trim().min(1)).max(100);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(''));

export const transactionFilterPresetSchema = z
  .object({
    version: z.number().int().positive().default(1),
    enabled: z.boolean().default(true),
    transactionType: z.enum(['', 'Chi tiêu', 'Thu nhập']).default('Chi tiêu'),
    status: z.enum(['', 'Thực tế', 'Dự kiến']).default('Thực tế'),
    period: z.enum(transactionFilterPeriodValues).default('current-month'),
    purposeIds: filterIdSchema.default([]),
    expenseTypeIds: filterIdSchema.default([]),
    paymentMethodIds: filterIdSchema.default([]),
    excludePurposeIds: filterIdSchema.default([]),
    excludeExpenseTypeIds: filterIdSchema.default([]),
    excludePaymentMethodIds: filterIdSchema.default([]),
    amountMin: z.string().regex(/^\d*$/).default(''),
    amountMax: z.string().regex(/^\d*$/).default(''),
    dateFrom: isoDateSchema.default(''),
    dateTo: isoDateSchema.default(''),
    sort: z.enum(transactionFilterSortValues).default('date-desc'),
  })
  .superRefine((value, context) => {
    if (value.period === 'custom' && value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateTo'],
        message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
      });
    }
    if (value.amountMin && value.amountMax && Number(value.amountMin) > Number(value.amountMax)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountMax'],
        message: 'Số tiền tối đa phải lớn hơn hoặc bằng số tiền tối thiểu.',
      });
    }
  });

export type TransactionFilterPreset = z.output<typeof transactionFilterPresetSchema>;

export type TransactionFilters = {
  query: string;
  transactionType: string;
  status: string;
  purposeIds: string[];
  expenseTypeIds: string[];
  paymentMethodIds: string[];
  excludePurposeIds: string[];
  excludeExpenseTypeIds: string[];
  excludePaymentMethodIds: string[];
  amountMin: string;
  amountMax: string;
  month: string;
  year: string;
  dateFrom: string;
  dateTo: string;
  sort: TransactionFilterSort;
};

export const normalizeAmountFilterInput = (value: string) =>
  value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

export const formatAmountFilterInput = (value: string) => {
  const normalized = normalizeAmountFilterInput(value);
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const getVietnamCurrentPeriod = (now = new Date()) => {
  const currentPeriod = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  return {
    month: currentPeriod.find((part) => part.type === 'month')?.value || '',
    year: currentPeriod.find((part) => part.type === 'year')?.value || '',
  };
};

export const createSystemTransactionFilterPreset = (
  purposes: CatalogItem[],
): TransactionFilterPreset => ({
  version: 1,
  enabled: true,
  transactionType: 'Chi tiêu',
  status: 'Thực tế',
  period: 'current-month',
  purposeIds: [],
  expenseTypeIds: [],
  paymentMethodIds: [],
  excludePurposeIds: purposes
    .filter((purpose) => normalizeText(purpose.name) === normalizeText('Đầu tư'))
    .map((purpose) => purpose.id),
  excludeExpenseTypeIds: [],
  excludePaymentMethodIds: [],
  amountMin: '',
  amountMax: '',
  dateFrom: '',
  dateTo: '',
  sort: 'date-desc',
});

export const resolveTransactionFilterPreset = (
  preset: TransactionFilterPreset,
  now = new Date(),
): TransactionFilters => {
  const currentPeriod = getVietnamCurrentPeriod(now);
  const period = preset.period === 'current-month'
    ? { month: currentPeriod.month, year: currentPeriod.year, dateFrom: '', dateTo: '' }
    : preset.period === 'current-year'
      ? { month: '', year: currentPeriod.year, dateFrom: '', dateTo: '' }
      : preset.period === 'custom'
        ? { month: '', year: '', dateFrom: preset.dateFrom, dateTo: preset.dateTo }
        : { month: '', year: '', dateFrom: '', dateTo: '' };

  return {
    query: '',
    transactionType: preset.transactionType,
    status: preset.status,
    purposeIds: [...preset.purposeIds],
    expenseTypeIds: [...preset.expenseTypeIds],
    paymentMethodIds: [...preset.paymentMethodIds],
    excludePurposeIds: [...preset.excludePurposeIds],
    excludeExpenseTypeIds: [...preset.excludeExpenseTypeIds],
    excludePaymentMethodIds: [...preset.excludePaymentMethodIds],
    amountMin: preset.amountMin,
    amountMax: preset.amountMax,
    month: period.month,
    year: period.year,
    dateFrom: period.dateFrom,
    dateTo: period.dateTo,
    sort: preset.sort,
  };
};

const catalogIds = (items: CatalogItem[]) => new Set(items.map((item) => item.id));
const keepKnownIds = (ids: string[], items: CatalogItem[]) => {
  const known = catalogIds(items);
  return ids.filter((id) => known.has(id));
};

export const sanitizeTransactionFilterPreset = (
  value: unknown,
  catalogs: {
    purposes: CatalogItem[];
    expenseTypes: CatalogItem[];
    paymentMethods: CatalogItem[];
  },
) => {
  const parsed = transactionFilterPresetSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    purposeIds: keepKnownIds(parsed.data.purposeIds, catalogs.purposes),
    excludePurposeIds: keepKnownIds(parsed.data.excludePurposeIds, catalogs.purposes),
    expenseTypeIds: keepKnownIds(parsed.data.expenseTypeIds, catalogs.expenseTypes),
    excludeExpenseTypeIds: keepKnownIds(parsed.data.excludeExpenseTypeIds, catalogs.expenseTypes),
    paymentMethodIds: keepKnownIds(parsed.data.paymentMethodIds, catalogs.paymentMethods),
    excludePaymentMethodIds: keepKnownIds(parsed.data.excludePaymentMethodIds, catalogs.paymentMethods),
  } satisfies TransactionFilterPreset;
};

export const transactionFilterUrlKeys = [
  'query',
  'transactionType',
  'status',
  'purposeId',
  'expenseTypeId',
  'paymentMethodId',
  'excludePurposeId',
  'excludeExpenseTypeId',
  'excludePaymentMethodId',
  'amountMin',
  'amountMax',
  'month',
  'year',
  'dateFrom',
  'dateTo',
  'includeAllPurposes',
  'sort',
] as const;

export const hasExplicitTransactionFilterParams = (searchParams: URLSearchParams) =>
  transactionFilterUrlKeys.some((key) => searchParams.has(key));

/**
 * Older versions wrote the system preset into the URL after the Transactions
 * screen mounted. Treat that exact shape as internal state so it cannot mask a
 * personal preset when the browser restores the app on a later launch.
 */
export const hasOnlySystemDefaultTransactionFilterParams = (searchParams: URLSearchParams) => {
  const keys = Array.from(new Set(searchParams.keys()));
  const systemKeys = new Set(['transactionType', 'status', 'month', 'year']);
  if (keys.length !== systemKeys.size || keys.some((key) => !systemKeys.has(key))) return false;
  if (searchParams.getAll('transactionType').length !== 1 || searchParams.get('transactionType') !== 'Chi tiêu') return false;
  if (searchParams.getAll('status').length !== 1 || searchParams.get('status') !== 'Thực tế') return false;
  return /^(0[1-9]|1[0-2])$/.test(searchParams.get('month') || '')
    && /^\d{4}$/.test(searchParams.get('year') || '');
};

export const transactionTypeFromFilter = (value: string): TransactionType | '' =>
  value === 'Chi tiêu' || value === 'Thu nhập' ? value : '';

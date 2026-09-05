import { z } from 'zod';
import type { Transaction } from './domain';

export const recurringFrequencies = ['weekly', 'monthly', 'yearly'] as const;
export type RecurringFrequency = (typeof recurringFrequencies)[number];

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ');

export const recurringTemplateSchema = z.object({
  transactionType: z.literal('Chi tiêu').default('Chi tiêu'),
  description: z.string().trim().min(1, 'Vui lòng nhập nội dung').max(200),
  amount: z.number().int().positive('Số tiền phải lớn hơn 0').max(999_999_999_999_999),
  purposeId: z.string().min(1, 'Vui lòng chọn mục đích'),
  expenseTypeId: z.string().min(1, 'Vui lòng chọn loại chi phí'),
  paymentMethodId: z.string().min(1, 'Vui lòng chọn phương thức thanh toán'),
  beneficiaryId: z.string().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type RecurringTemplate = z.infer<typeof recurringTemplateSchema>;

export const recurringExpenseSchema = z.object({
  id: z.string().min(1),
  familyId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  template: recurringTemplateSchema,
  frequency: z.enum(recurringFrequencies),
  nextRunDate: dateOnlySchema,
  endDate: dateOnlySchema.nullable().optional(),
  anchorDay: z.number().int().min(1).max(31).optional(),
  anchorMonth: z.number().int().min(1).max(12).optional(),
  active: z.boolean(),
  createdBy: z.string().nullable().optional(),
  lastRunAt: z.string().nullable().optional(),
  lastErrorCode: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});

export type RecurringExpense = z.infer<typeof recurringExpenseSchema>;

export const recurringExpenseInputSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên mẫu').max(100),
  template: recurringTemplateSchema,
  frequency: z.enum(recurringFrequencies),
  nextRunDate: dateOnlySchema,
  endDate: dateOnlySchema.nullable(),
}).refine((value) => !value.endDate || value.endDate >= value.nextRunDate, {
  path: ['endDate'],
  message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi',
});

export type RecurringExpenseInput = z.infer<typeof recurringExpenseInputSchema>;

const dateParts = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export function nextRecurringDate(
  value: string,
  frequency: RecurringFrequency,
  anchorDay?: number,
  anchorMonth?: number,
) {
  const parts = dateParts(value);
  if (!parts) throw new Error('INVALID_DATE');
  if (frequency === 'weekly') {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 7));
    return isoDate(date);
  }
  const day = anchorDay || parts.day;
  if (frequency === 'monthly') {
    const year = parts.month === 12 ? parts.year + 1 : parts.year;
    const month = parts.month === 12 ? 1 : parts.month + 1;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day, daysInMonth(year, month))).padStart(2, '0')}`;
  }
  const year = parts.year + 1;
  const month = anchorMonth || parts.month;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day, daysInMonth(year, month))).padStart(2, '0')}`;
}

export function recurringForecastDates(
  value: string,
  frequency: RecurringFrequency,
  anchorDay?: number,
  anchorMonth?: number,
  endDate?: string | null,
  count = 3,
) {
  const dates: string[] = [];
  let current = value;
  for (let index = 0; index < count; index += 1) {
    if (endDate && current > endDate) break;
    dates.push(current);
    current = nextRecurringDate(current, frequency, anchorDay, anchorMonth);
  }
  return dates;
}

export function todayInVietnam(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : isoDate(now);
}

export type RecurringExpenseRow = {
  id: string;
  family_id: string;
  name: string;
  template: unknown;
  frequency: string;
  next_run_date: string | null;
  end_date: string | null;
  anchor_day: number | null;
  anchor_month: number | null;
  active: boolean;
  created_by: string | null;
  last_run_at: string | null;
  last_error_code: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

export function mapRecurringExpenseRow(row: RecurringExpenseRow): RecurringExpense {
  const parsed = recurringExpenseSchema.safeParse({
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    template: row.template,
    frequency: row.frequency,
    nextRunDate: row.next_run_date,
    endDate: row.end_date,
    anchorDay: row.anchor_day || undefined,
    anchorMonth: row.anchor_month || undefined,
    active: row.active,
    createdBy: row.created_by,
    lastRunAt: row.last_run_at,
    lastErrorCode: row.last_error_code,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
  });
  if (!parsed.success) throw new Error('INVALID_RECURRING_EXPENSE');
  return parsed.data;
}

const localStorageKey = (familyId: string) => `family-expense:recurring-expenses:${familyId}`;

export function getLocalRecurringExpenses(familyId: string): RecurringExpense[] {
  try {
    const raw = window.localStorage.getItem(localStorageKey(familyId));
    const parsed = z.array(recurringExpenseSchema).safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data.filter((item) => !item.deletedAt) : [];
  } catch {
    return [];
  }
}

function saveLocalRecurringExpenses(familyId: string, items: RecurringExpense[]) {
  window.localStorage.setItem(localStorageKey(familyId), JSON.stringify(items));
}

function localId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `local-recurring-${Date.now()}`;
}

export function upsertLocalRecurringExpense(
  familyId: string,
  input: RecurringExpenseInput,
  id?: string,
): RecurringExpense {
  const items = getLocalRecurringExpenses(familyId);
  const current = items.find((item) => item.id === id);
  const parts = dateParts(input.nextRunDate);
  const next: RecurringExpense = {
    id: current?.id || id || localId(),
    familyId,
    name: input.name.trim(),
    template: input.template,
    frequency: input.frequency,
    nextRunDate: input.nextRunDate,
    endDate: input.endDate,
    anchorDay: current && current.frequency === input.frequency && current.nextRunDate === input.nextRunDate
      ? current.anchorDay
      : parts?.day,
    anchorMonth: current && current.frequency === input.frequency && current.nextRunDate === input.nextRunDate
      ? current.anchorMonth
      : parts?.month,
    active: current?.active ?? true,
    createdBy: 'local-user',
    lastRunAt: current?.lastRunAt || null,
    lastErrorCode: null,
  };
  saveLocalRecurringExpenses(familyId, [...items.filter((item) => item.id !== next.id), next]);
  return next;
}

export function setLocalRecurringExpenseActive(familyId: string, id: string, active: boolean) {
  const items = getLocalRecurringExpenses(familyId);
  saveLocalRecurringExpenses(familyId, items.map((item) => item.id === id ? { ...item, active } : item));
}

export function deleteLocalRecurringExpense(familyId: string, id: string) {
  const items = getLocalRecurringExpenses(familyId);
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error('NOT_FOUND');
  saveLocalRecurringExpenses(familyId, items.map((entry) => entry.id === id ? {
    ...entry,
    active: false,
    deletedAt: new Date().toISOString(),
    deletedBy: 'local-user',
  } : entry));
}

export function skipLocalRecurringOccurrence(familyId: string, id: string) {
  const items = getLocalRecurringExpenses(familyId);
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error('NOT_FOUND');
  const nextRunDate = nextRecurringDate(item.nextRunDate, item.frequency, item.anchorDay, item.anchorMonth);
  saveLocalRecurringExpenses(familyId, items.map((entry) => entry.id === id ? {
    ...entry,
    nextRunDate,
    active: entry.endDate ? nextRunDate <= entry.endDate : entry.active,
    lastRunAt: new Date().toISOString(),
  } : entry));
  return nextRunDate;
}

export function generateLocalDueTransactions(
  familyId: string,
  currentUserId: string,
  transactions: Transaction[],
  until = todayInVietnam(),
) {
  const items = getLocalRecurringExpenses(familyId);
  const created: Transaction[] = [];
  const updated = items.map((item) => {
    if (!item.active || item.nextRunDate > until) return item;
    let occurrence = item.nextRunDate;
    let nextRunDate = item.nextRunDate;
    while (occurrence <= until && (!item.endDate || occurrence <= item.endDate)) {
      const sourceReference = `recurring:${item.id}:${occurrence}`;
      if (!transactions.some((transaction) => transaction.sourceReference === sourceReference) && !created.some((transaction) => transaction.sourceReference === sourceReference)) {
        created.push({
          id: localId(),
          familyId,
          transactionDate: occurrence,
          transactionType: 'Chi tiêu',
          status: 'Dự kiến',
          description: item.template.description,
          amount: item.template.amount,
          purposeId: item.template.purposeId,
          expenseTypeId: item.template.expenseTypeId,
          beneficiaryId: item.template.beneficiaryId || null,
          paymentMethodId: item.template.paymentMethodId,
          note: item.template.note || null,
          source: 'recurring',
          sourceReference,
          aiGenerated: false,
          createdBy: currentUserId,
          deletedAt: null,
        });
      }
      nextRunDate = nextRecurringDate(occurrence, item.frequency, item.anchorDay, item.anchorMonth);
      occurrence = nextRunDate;
    }
    return {
      ...item,
      nextRunDate,
      active: item.endDate ? nextRunDate <= item.endDate : item.active,
      lastRunAt: new Date().toISOString(),
      lastErrorCode: null,
    };
  });
  saveLocalRecurringExpenses(familyId, updated);
  return created;
}

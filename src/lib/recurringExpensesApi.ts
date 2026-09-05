import { supabase } from './supabase';
import { z } from 'zod';
import {
  mapRecurringExpenseRow,
  recurringExpenseSchema,
  type RecurringExpense,
  type RecurringExpenseInput,
  type RecurringExpenseRow,
} from './recurringExpense';

const recurringRunSchema = z.object({
  id: z.string().min(1),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['generated', 'skipped']),
  transactionId: z.string().nullable(),
  performedAt: z.string().min(1),
});

export type RecurringRun = z.infer<typeof recurringRunSchema>;

export async function fetchRecurringExpenses(familyId: string, includeDeleted = false): Promise<RecurringExpense[]> {
  let request = supabase
    .from('recurring_transactions')
    .select('id,family_id,name,template,frequency,next_run_date,end_date,anchor_day,anchor_month,active,created_by,last_run_at,last_error_code,deleted_at,deleted_by,deleted_active_before')
    .eq('family_id', familyId)
    .order('active', { ascending: false })
    .order('next_run_date', { ascending: true });
  if (!includeDeleted) request = request.is('deleted_at', null);
  const { data, error } = await request;
  if (error) throw error;
  return ((data || []) as RecurringExpenseRow[]).map(mapRecurringExpenseRow);
}

export async function fetchRecurringRuns(
  familyId: string,
  recurringTransactionId: string,
): Promise<RecurringRun[]> {
  const { data, error } = await supabase
    .from('recurring_transaction_runs')
    .select('id,occurrence_date,status,transaction_id,performed_at')
    .eq('family_id', familyId)
    .eq('recurring_transaction_id', recurringTransactionId)
    .order('occurrence_date', { ascending: false })
    .limit(24);
  if (error) throw error;
  const parsed = z.array(z.object({
    id: z.string(),
    occurrence_date: z.string(),
    status: z.enum(['generated', 'skipped']),
    transaction_id: z.string().nullable(),
    performed_at: z.string(),
  })).safeParse(data || []);
  if (!parsed.success) throw new Error('INVALID_RECURRING_RUN');
  return parsed.data.map((row) => recurringRunSchema.parse({
    id: row.id,
    occurrenceDate: row.occurrence_date,
    status: row.status,
    transactionId: row.transaction_id,
    performedAt: row.performed_at,
  }));
}

export async function upsertRecurringExpense(
  familyId: string,
  input: RecurringExpenseInput,
  id?: string,
) {
  const { data, error } = await supabase.rpc('upsert_recurring_transaction', {
    p_family_id: familyId,
    p_id: id || null,
    p_name: input.name,
    p_template: input.template,
    p_frequency: input.frequency,
    p_next_run_date: input.nextRunDate,
    p_end_date: input.endDate,
  });
  if (error) throw error;
  const parsed = recurringExpenseSchema.safeParse({
    id: (data as RecurringExpenseRow).id,
    familyId: (data as RecurringExpenseRow).family_id,
    name: (data as RecurringExpenseRow).name,
    template: (data as RecurringExpenseRow).template,
    frequency: (data as RecurringExpenseRow).frequency,
    nextRunDate: (data as RecurringExpenseRow).next_run_date,
    endDate: (data as RecurringExpenseRow).end_date,
    anchorDay: (data as RecurringExpenseRow).anchor_day || undefined,
    anchorMonth: (data as RecurringExpenseRow).anchor_month || undefined,
    active: (data as RecurringExpenseRow).active,
    createdBy: (data as RecurringExpenseRow).created_by,
    lastRunAt: (data as RecurringExpenseRow).last_run_at,
    lastErrorCode: (data as RecurringExpenseRow).last_error_code,
  });
  if (!parsed.success) throw new Error('INVALID_RECURRING_EXPENSE');
  return parsed.data;
}

export async function setRecurringExpenseActive(
  familyId: string,
  id: string,
  active: boolean,
) {
  const { data, error } = await supabase.rpc('set_recurring_transaction_active', {
    p_family_id: familyId,
    p_id: id,
    p_active: active,
  });
  if (error) throw error;
  if (!data) throw new Error('NOT_FOUND');
}

export async function deleteRecurringExpense(familyId: string, id: string) {
  const { data, error } = await supabase.rpc('delete_recurring_transaction', {
    p_family_id: familyId,
    p_id: id,
  });
  if (error) throw error;
  if (!data) throw new Error('NOT_FOUND');
}

export async function restoreRecurringExpense(familyId: string, id: string) {
  const { data, error } = await supabase.rpc('restore_recurring_transaction', {
    p_family_id: familyId,
    p_id: id,
  });
  if (error) throw error;
  if (!data) throw new Error('NOT_FOUND');
}

export async function permanentlyDeleteRecurringExpense(familyId: string, id: string) {
  const { data, error } = await supabase.rpc('permanently_delete_recurring_transaction', {
    p_family_id: familyId,
    p_id: id,
  });
  if (error) throw error;
  if (!data) throw new Error('NOT_FOUND');
}

export async function skipRecurringOccurrence(familyId: string, id: string) {
  const { data, error } = await supabase.rpc('skip_recurring_occurrence', {
    p_family_id: familyId,
    p_id: id,
  });
  if (error) throw error;
  return data as string | null;
}

export async function generateDueRecurringTransactions(
  familyId: string,
  until?: string,
) {
  const { data, error } = await supabase.rpc('generate_due_recurring_transactions', {
    p_family_id: familyId,
    p_until: until || null,
  });
  if (error) throw error;
  return Number(data || 0);
}

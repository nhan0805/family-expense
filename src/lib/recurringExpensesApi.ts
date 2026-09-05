import { supabase } from './supabase';
import {
  mapRecurringExpenseRow,
  recurringExpenseSchema,
  type RecurringExpense,
  type RecurringExpenseInput,
  type RecurringExpenseRow,
} from './recurringExpense';

export async function fetchRecurringExpenses(familyId: string): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('id,family_id,name,template,frequency,next_run_date,end_date,anchor_day,anchor_month,active,created_by,last_run_at,last_error_code')
    .eq('family_id', familyId)
    .order('active', { ascending: false })
    .order('next_run_date', { ascending: true });
  if (error) throw error;
  return ((data || []) as RecurringExpenseRow[]).map(mapRecurringExpenseRow);
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

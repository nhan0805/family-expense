import { isSupabaseConfigured, supabase } from './supabase';
import {
  automaticTransactionDefaultsSchema,
  automaticTransactionKeys,
  type AutomaticTransactionDefault,
} from './automaticTransactionDefaults';

export const automaticTransactionDefaultsStorageKey = (familyId: string) =>
  `family-expense:automatic-transaction-defaults:${familyId}`;

type AutomaticTransactionDefaultRow = {
  automation_key: string;
  purpose_id: string;
  expense_type_id: string;
  payment_method_id: string;
};

const mapRow = (row: AutomaticTransactionDefaultRow): AutomaticTransactionDefault | null => {
  if (!automaticTransactionKeys.includes(row.automation_key as AutomaticTransactionDefault['automationKey'])) return null;
  return {
    automationKey: row.automation_key as AutomaticTransactionDefault['automationKey'],
    purposeId: row.purpose_id,
    expenseTypeId: row.expense_type_id,
    paymentMethodId: row.payment_method_id,
  };
};

export async function fetchAutomaticTransactionDefaults(familyId: string): Promise<AutomaticTransactionDefault[] | null> {
  if (!familyId) return null;
  if (!isSupabaseConfigured) {
    try {
      const raw = localStorage.getItem(automaticTransactionDefaultsStorageKey(familyId));
      if (!raw) return null;
      const parsed = automaticTransactionDefaultsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase
    .from('automatic_transaction_defaults')
    .select('automation_key,purpose_id,expense_type_id,payment_method_id')
    .eq('family_id', familyId)
    .order('automation_key');
  if (error) throw error;
  return (data || []).map((row) => mapRow(row as AutomaticTransactionDefaultRow)).filter((row): row is AutomaticTransactionDefault => Boolean(row));
}

export async function saveAutomaticTransactionDefaults(
  familyId: string,
  defaults: AutomaticTransactionDefault[],
) {
  const parsed = automaticTransactionDefaultsSchema.safeParse(defaults);
  if (!parsed.success) throw new Error('INVALID_AUTOMATIC_TRANSACTION_DEFAULTS');

  if (!isSupabaseConfigured) {
    try {
      localStorage.setItem(automaticTransactionDefaultsStorageKey(familyId), JSON.stringify(parsed.data));
      return parsed.data;
    } catch {
      throw new Error('LOCAL_STORAGE_UNAVAILABLE');
    }
  }

  const { data, error } = await supabase.rpc('save_automatic_transaction_defaults', {
    p_family_id: familyId,
    p_defaults: parsed.data.map((item) => ({
      automation_key: item.automationKey,
      purpose_id: item.purposeId,
      expense_type_id: item.expenseTypeId,
      payment_method_id: item.paymentMethodId,
    })),
  });
  if (error) throw error;
  return (data || parsed.data).map((row: AutomaticTransactionDefaultRow | AutomaticTransactionDefault) =>
    'automationKey' in row ? row : mapRow(row)!
  );
}

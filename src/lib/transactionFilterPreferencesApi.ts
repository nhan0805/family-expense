import { supabase, isSupabaseConfigured } from './supabase';
import {
  transactionFilterPresetSchema,
  type TransactionFilterPreset,
} from './transactionFilters';

export type TransactionFilterPreference = TransactionFilterPreset;

export const transactionFilterPreferenceKey = (familyId: string, userId: string) =>
  `family-expense:transaction-filter-preference:${familyId}:${userId}`;

const parsePreference = (value: unknown): TransactionFilterPreference | null => {
  const parsed = transactionFilterPresetSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export async function fetchTransactionFilterPreference(
  familyId: string,
  userId: string,
): Promise<TransactionFilterPreference | null> {
  if (!familyId || !userId) return null;
  if (!isSupabaseConfigured) {
    try {
      const raw = localStorage.getItem(transactionFilterPreferenceKey(familyId, userId));
      return raw ? parsePreference(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase
    .from('transaction_filter_preferences')
    .select('filters')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return parsePreference((data as { filters?: unknown } | null)?.filters);
}

export async function saveTransactionFilterPreference(
  familyId: string,
  userId: string,
  preference: TransactionFilterPreference,
) {
  const parsed = transactionFilterPresetSchema.safeParse(preference);
  if (!parsed.success) throw new Error('INVALID_TRANSACTION_FILTERS');

  if (!isSupabaseConfigured) {
    try {
      localStorage.setItem(transactionFilterPreferenceKey(familyId, userId), JSON.stringify(parsed.data));
      return;
    } catch {
      throw new Error('LOCAL_STORAGE_UNAVAILABLE');
    }
  }

  const { error } = await supabase
    .from('transaction_filter_preferences')
    .upsert(
      {
        family_id: familyId,
        user_id: userId,
        filters: parsed.data,
      },
      { onConflict: 'family_id,user_id' },
    );
  if (error) throw error;
}

export async function clearTransactionFilterPreference(
  familyId: string,
  userId: string,
) {
  if (!familyId || !userId) return;
  if (!isSupabaseConfigured) {
    try {
      localStorage.removeItem(transactionFilterPreferenceKey(familyId, userId));
      return;
    } catch {
      throw new Error('LOCAL_STORAGE_UNAVAILABLE');
    }
  }

  const { error } = await supabase
    .from('transaction_filter_preferences')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId);
  if (error) throw error;
}

import type { CatalogItem } from './domain';
import {
  budgetSummarySchema,
  type BudgetInput,
  type BudgetSummary,
} from './budget';
import { supabase } from './supabase';

export async function fetchBudgetSummary(
  familyId: string,
  year: number,
  month: number,
): Promise<BudgetSummary> {
  const { data, error } = await supabase.rpc('get_budget_summary', {
    p_family_id: familyId,
    p_year: year,
    p_month: month,
  });
  if (error) throw error;
  const parsed = budgetSummarySchema.safeParse(data);
  if (!parsed.success) throw new Error('INVALID_BUDGET_SUMMARY');
  return parsed.data;
}
export async function upsertBudget(familyId: string, input: BudgetInput) {
  const { error } = await supabase.rpc('upsert_budget', {
    p_family_id: familyId,
    p_year: input.year,
    p_month: input.month,
    p_purpose_id: input.purposeId,
    p_amount: input.amount,
    p_warning_threshold: input.warningThreshold,
  });
  if (error) throw error;
}

export async function deleteBudget(familyId: string, budgetId: string) {
  const { error } = await supabase.rpc('delete_budget', {
    p_family_id: familyId,
    p_budget_id: budgetId,
  });
  if (error) throw error;
}

export async function copyBudgets(
  familyId: string,
  sourceYear: number,
  sourceMonth: number,
  targetYear: number,
  targetMonth: number,
) {
  const { data, error } = await supabase.rpc('copy_budgets_from_month', {
    p_family_id: familyId,
    p_source_year: sourceYear,
    p_source_month: sourceMonth,
    p_target_year: targetYear,
    p_target_month: targetMonth,
  });
  if (error) throw error;
  return Number(data || 0);
}

export function buildBudgetFilterLink(
  purposeId: string,
  year: number,
  month: number,
) {
  const params = new URLSearchParams({
    transactionType: 'Chi tiêu',
    purposeId,
    month: String(month).padStart(2, '0'),
    year: String(year),
  });
  return `/giao-dich?${params.toString()}`;
}

export function purposeOptions(items: CatalogItem[], language: 'vi' | 'en') {
  return items.map((item) => ({
    id: item.id,
    name: language === 'en' ? item.nameEn || item.name : item.name,
  }));
}

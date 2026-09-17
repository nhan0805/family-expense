import type { CatalogItem } from './domain';
import { isSupabaseConfigured, supabase } from './supabase';

export type CatalogTemplateSnapshot = {
  purposes: CatalogItem[];
  expenseTypes: CatalogItem[];
  paymentMethods: CatalogItem[];
};

const localTemplateStorageKey = 'family-expense-system-catalog-template';

const parseCatalogItems = (value: unknown): CatalogItem[] | null => {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item): item is CatalogItem => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Partial<CatalogItem>;
    return typeof candidate.id === 'string' && typeof candidate.name === 'string';
  });
  return items.length === value.length ? items : null;
};

export const saveLocalCatalogTemplate = (snapshot: CatalogTemplateSnapshot) => {
  try {
    window.localStorage.setItem(localTemplateStorageKey, JSON.stringify(snapshot));
  } catch {
    // Demo mode should remain usable even when browser storage is unavailable.
  }
};

export const loadLocalCatalogTemplate = (): CatalogTemplateSnapshot | null => {
  try {
    const raw = window.localStorage.getItem(localTemplateStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogTemplateSnapshot>;
    const purposes = parseCatalogItems(parsed.purposes);
    const expenseTypes = parseCatalogItems(parsed.expenseTypes);
    const paymentMethods = parseCatalogItems(parsed.paymentMethods);
    if (!purposes || !expenseTypes || !paymentMethods) return null;
    return { purposes, expenseTypes, paymentMethods };
  } catch {
    return null;
  }
};

export const saveSystemCatalogTemplate = async (familyId: string) => {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('save_system_catalog_template', {
    p_family_id: familyId,
  });
  if (error) throw error;
};

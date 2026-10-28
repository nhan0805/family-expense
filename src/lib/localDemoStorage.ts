import { z } from 'zod';
import {
  transactionSchema,
  type CatalogItem,
  type Transaction,
} from './domain';

export type LocalDemoMember = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: 'owner' | 'member';
  status: 'active' | 'invited' | 'disabled';
  created_at: string;
};

export type LocalDemoState = {
  familyName: string;
  purposes: CatalogItem[];
  expenseTypes: CatalogItem[];
  paymentMethods: CatalogItem[];
  transactions: Transaction[];
};

const stateKey = (familyId: string) => `family-expense:demo-state:${familyId}`;
const membersKey = (familyId: string) => `family-expense:demo-members:${familyId}`;

const catalogItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  active: z.boolean().optional(),
  budgetEnabled: z.boolean().optional(),
});

const memberSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  display_name: z.string().min(1),
  email: z.string().min(1),
  role: z.enum(['owner', 'member']),
  status: z.enum(['active', 'invited', 'disabled']),
  created_at: z.string().min(1),
});

const readJson = (key: string): unknown => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const parseCatalogItems = (value: unknown): CatalogItem[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const parsed = z.array(catalogItemSchema).safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const parseTransactions = (value: unknown): Transaction[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = transactionSchema.safeParse(item);
    if (!parsed.success || typeof item !== 'object' || item === null) return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== 'string' || !raw.id) return [];
    return [{
      ...parsed.data,
      id: raw.id,
      createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : undefined,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
      deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : raw.deletedAt === null ? null : undefined,
      recurringTransactionId: typeof raw.recurringTransactionId === 'string'
        ? raw.recurringTransactionId
        : raw.recurringTransactionId === null ? null : undefined,
    } satisfies Transaction];
  });
};

export function readLocalDemoState(familyId: string): Partial<LocalDemoState> {
  const value = readJson(stateKey(familyId));
  if (typeof value !== 'object' || value === null) return {};
  const raw = value as Record<string, unknown>;
  return {
    familyName: typeof raw.familyName === 'string' && raw.familyName.trim()
      ? raw.familyName.trim().slice(0, 100)
      : undefined,
    purposes: parseCatalogItems(raw.purposes),
    expenseTypes: parseCatalogItems(raw.expenseTypes),
    paymentMethods: parseCatalogItems(raw.paymentMethods),
    transactions: parseTransactions(raw.transactions),
  };
}

export function saveLocalDemoState(familyId: string, state: LocalDemoState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(stateKey(familyId), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function readLocalDemoMembers(familyId: string): LocalDemoMember[] {
  const parsed = z.array(memberSchema).safeParse(readJson(membersKey(familyId)) || []);
  return parsed.success ? parsed.data : [];
}

export function saveLocalDemoMembers(familyId: string, members: LocalDemoMember[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(membersKey(familyId), JSON.stringify(members));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalDemoData(familyId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(stateKey(familyId));
    window.localStorage.removeItem(membersKey(familyId));
  } catch {
    // Storage may be unavailable in private browsing; in-memory state still resets.
  }
}

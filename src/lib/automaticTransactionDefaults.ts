import { z } from 'zod';
import { normalizeText, type CatalogItem } from './domain';

export const automaticTransactionKeys = [
  'savings_opening',
  'savings_interest',
  'savings_settlement',
  'gold_purchase',
  'gold_sale',
] as const;

export type AutomaticTransactionKey = (typeof automaticTransactionKeys)[number];

export type AutomaticTransactionCatalogs = {
  purposes: CatalogItem[];
  expenseTypes: CatalogItem[];
  paymentMethods: CatalogItem[];
};

export type AutomaticTransactionDefault = {
  automationKey: AutomaticTransactionKey;
  purposeId: string;
  expenseTypeId: string;
  paymentMethodId: string;
};

export const automaticTransactionDefaultSchema = z.object({
  automationKey: z.enum(automaticTransactionKeys),
  purposeId: z.string().trim().min(1),
  expenseTypeId: z.string().trim().min(1),
  paymentMethodId: z.string().trim().min(1),
});

export const automaticTransactionDefaultsSchema = z
  .array(automaticTransactionDefaultSchema)
  .length(automaticTransactionKeys.length)
  .superRefine((items, context) => {
    if (new Set(items.map((item) => item.automationKey)).size !== automaticTransactionKeys.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Each automatic transaction key must appear once.' });
    }
  });

export const automaticTransactionLabels: Record<AutomaticTransactionKey, { vi: string; en: string; descriptionVi: string; descriptionEn: string }> = {
  savings_opening: {
    vi: 'Mở sổ tiết kiệm',
    en: 'Open savings book',
    descriptionVi: 'Khoản chi khi gửi tiền vào sổ mới.',
    descriptionEn: 'Expense created when money is deposited into a new book.',
  },
  savings_interest: {
    vi: 'Nhận lãi tiết kiệm',
    en: 'Receive savings interest',
    descriptionVi: 'Khoản thu khi ghi nhận tiền lãi.',
    descriptionEn: 'Income created when interest is recorded.',
  },
  savings_settlement: {
    vi: 'Tất toán tiết kiệm',
    en: 'Settle savings book',
    descriptionVi: 'Khoản thu khi đóng sổ và nhận lại tiền.',
    descriptionEn: 'Income created when a book is settled.',
  },
  gold_purchase: {
    vi: 'Mua vàng',
    en: 'Buy gold',
    descriptionVi: 'Khoản chi khi thêm một lô vàng.',
    descriptionEn: 'Expense created when a gold lot is added.',
  },
  gold_sale: {
    vi: 'Bán vàng',
    en: 'Sell gold',
    descriptionVi: 'Khoản thu khi ghi nhận bán vàng.',
    descriptionEn: 'Income created when gold is sold.',
  },
};

const findByName = (items: CatalogItem[], names: string[]) =>
  items.find((item) => names.some((name) => normalizeText(item.name) === normalizeText(name)))?.id
  || items.find((item) => normalizeText(item.name) === normalizeText('Khác'))?.id
  || items[0]?.id
  || '';

const defaultPaymentMethodId = (catalogs: AutomaticTransactionCatalogs) =>
  findByName(catalogs.paymentMethods, ['Chuyển khoản']);

const defaultExpenseTypeNames: Record<AutomaticTransactionKey, string[]> = {
  savings_opening: ['Gửi tiết kiệm'],
  savings_interest: ['Lãi tiền gửi'],
  savings_settlement: ['Tất toán tiết kiệm'],
  gold_purchase: ['Đầu tư vàng'],
  gold_sale: ['Đầu tư vàng'],
};

export const createSystemAutomaticTransactionDefaults = (catalogs: AutomaticTransactionCatalogs): AutomaticTransactionDefault[] =>
  automaticTransactionKeys.map((automationKey) => ({
    automationKey,
    purposeId: findByName(catalogs.purposes, ['Đầu tư']),
    expenseTypeId: findByName(catalogs.expenseTypes, defaultExpenseTypeNames[automationKey]),
    paymentMethodId: defaultPaymentMethodId(catalogs),
  }));

export const sanitizeAutomaticTransactionDefaults = (
  value: unknown,
  catalogs: AutomaticTransactionCatalogs,
): AutomaticTransactionDefault[] => {
  const systemDefaults = createSystemAutomaticTransactionDefaults(catalogs);
  const parsed = z.array(automaticTransactionDefaultSchema).safeParse(value);
  const saved = parsed.success ? parsed.data : [];

  return automaticTransactionKeys.map((automationKey) => {
    const systemDefault = systemDefaults.find((item) => item.automationKey === automationKey)!;
    const savedDefault = saved.find((item) => item.automationKey === automationKey);
    return {
      automationKey,
      purposeId: catalogs.purposes.some((item) => item.id === savedDefault?.purposeId)
        ? savedDefault!.purposeId
        : systemDefault.purposeId,
      expenseTypeId: catalogs.expenseTypes.some((item) => item.id === savedDefault?.expenseTypeId)
        ? savedDefault!.expenseTypeId
        : systemDefault.expenseTypeId,
      paymentMethodId: catalogs.paymentMethods.some((item) => item.id === savedDefault?.paymentMethodId)
        ? savedDefault!.paymentMethodId
        : systemDefault.paymentMethodId,
    };
  });
};

import { z } from 'zod';
export const transactionTypes = [
  'Chi tiêu',
  'Hoàn tiền',
  'Thu nhập',
  'Tạm ứng',
] as const;
export const transactionTypeLabel = (type: string) => type === 'Chi tiêu' ? 'Tiền ra' : type === 'Thu nhập' ? 'Tiền vào' : type;
export const statuses = ['Thực tế', 'Dự kiến'] as const;
export const statusForTransactionDate = (
  transactionDate: string,
  today: string,
): (typeof statuses)[number] =>
  transactionDate > today ? 'Dự kiến' : 'Thực tế';
export const transactionSchema = z
  .object({
    id: z.string().optional(),
    familyId: z.string().optional(),
    transactionDate: z.string().min(1, 'Vui lòng chọn ngày'),
    transactionType: z.enum(transactionTypes),
    status: z.enum(statuses),
    description: z.string().trim().min(1, 'Vui lòng nhập nội dung'),
    amount: z.number().positive('Số tiền phải lớn hơn 0'),
    purposeId: z.string().min(1, 'Vui lòng chọn mục đích'),
    expenseTypeId: z.string().min(1, 'Vui lòng chọn loại chi phí'),
    eventId: z.string().nullable().optional(),
    beneficiaryId: z.string().nullable().optional(),
    paymentMethodId: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    source: z.enum(['manual', 'ai', 'excel_import']).default('manual'),
    sourceReference: z.string().nullable().optional(),
    aiGenerated: z.boolean().default(false),
  })
  .refine((data) => Boolean(data.paymentMethodId?.trim()), {
    path: ['paymentMethodId'],
    message: 'Vui lòng chọn phương thức thanh toán',
  });
export type TransactionFormInput = z.input<typeof transactionSchema>;
export type TransactionInput = z.output<typeof transactionSchema>;
export type Transaction = TransactionInput & {
  id: string;
  createdBy?: string;
  createdAt?: string;
  deletedAt?: string | null;
};
export const canDeleteTransaction = (
  transaction: Transaction,
  role: 'owner' | 'member' | null,
  currentUserId: string,
) =>
  role === 'owner' ||
  (role === 'member' && transaction.createdBy === currentUserId);
export type CatalogItem = {
  id: string;
  name: string;
  nameEn?: string;
  color?: string;
  active?: boolean;
};
export type CatalogLanguage = 'vi' | 'en';
export const purposeNames = [
  'Sinh hoạt gia đình',
  'Con cái',
  'Du lịch',
  'Hiếu hỉ & quan hệ',
  'Nhà cửa & gia dụng',
  'Xe cộ',
  'Sức khỏe gia đình',
  'Thai sản',
  'Đầu tư',
  'Khác',
];
export const expenseTypeNames = [
  'Ăn uống',
  'Thực phẩm',
  'Điện',
  'Nước',
  'Internet',
  'Di chuyển',
  'Xăng',
  'ETC',
  'Khách sạn',
  'Vé máy bay',
  'Quần áo',
  'Giày dép',
  'Gia dụng',
  'Giáo dục',
  'Sức khỏe',
  'Mỹ phẩm',
  'Giải trí',
  'Đồ chơi',
  'Tiêu dùng',
  'Thú cưng',
  'Đám cưới',
  'Sinh nhật',
  'Lì xì',
  'Quà',
  'Đầu tư chứng khoán',
  'Đầu tư vàng',
  'Khác',
];
export const paymentMethodNames = [
  'Chuyển khoản',
  'Thẻ tín dụng',
  'Trả góp',
  'Urbox',
  'Tiền mặt',
];
export const purposeNameEn = [
  'Family living',
  'Children',
  'Travel',
  'Family occasions & relationships',
  'Home & household',
  'Vehicles',
  'Family health',
  'Maternity',
  'Investments',
  'Other',
];
export const expenseTypeNameEn = [
  'Dining',
  'Groceries',
  'Electricity',
  'Water',
  'Internet',
  'Transport',
  'Fuel',
  'ETC',
  'Hotels',
  'Flights',
  'Clothing',
  'Shoes',
  'Household goods',
  'Education',
  'Healthcare',
  'Cosmetics',
  'Entertainment',
  'Toys',
  'Shopping',
  'Pets',
  'Weddings',
  'Birthdays',
  'Lucky money',
  'Gifts',
  'Stock investments',
  'Gold investments',
  'Other',
];
export const paymentMethodNameEn = [
  'Bank transfer',
  'Credit card',
  'Installments',
  'Urbox',
  'Cash',
];
export const makeItems = (names: string[], namesEn: string[] = []): CatalogItem[] =>
  names.map((name, i) => ({
    id: `local-${i}-${name}`,
    name,
    nameEn: namesEn[i],
    active: true,
  }));
export type CatalogItemRow = {
  id: string;
  name: string;
  name_en?: string | null;
  color?: string | null;
  active?: boolean | null;
};
export const mapCatalogItem = (row: CatalogItemRow): CatalogItem => ({
  id: row.id,
  name: row.name,
  nameEn: row.name_en || undefined,
  ...(row.color ? { color: row.color } : {}),
  ...(row.active === null || row.active === undefined ? {} : { active: row.active }),
});
export const getCatalogDisplayName = (
  item: Pick<CatalogItem, 'name' | 'nameEn'> | undefined,
  language: CatalogLanguage,
) => language === 'en' ? item?.nameEn?.trim() || item?.name || '' : item?.name || '';
export const getNetExpense = (amount: number, type: string) =>
  type === 'Hoàn tiền' ? -amount : type === 'Chi tiêu' ? amount : 0;
export const getTransactionTotalImpact = (amount: number, type: string) =>
  type === 'Thu nhập' || type === 'Hoàn tiền' ? -amount : amount;
export const formatVnd = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
export const formatCompactVnd = (value: number) => {
  const absolute = Math.abs(value);
  const compact =
    absolute >= 1_000_000
      ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(absolute / 1_000_000)}M`
      : absolute >= 1_000
        ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(absolute / 1_000)}K`
        : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(
            absolute,
          );
  return `${value < 0 ? '-' : ''}${compact} ₫`;
};
export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const similarity = (a: string, b: string) => {
  const x = new Set(normalizeText(a).split(' ')),
    y = new Set(normalizeText(b).split(' '));
  if (!x.size || !y.size) return 0;
  const n = [...x].filter((v) => y.has(v)).length;
  return n / Math.max(x.size, y.size);
};
export const findDuplicates = (
  candidate: TransactionInput,
  items: Transaction[],
) =>
  items.filter(
    (t) =>
      !t.deletedAt &&
      t.transactionDate === candidate.transactionDate &&
      t.amount === candidate.amount &&
      similarity(t.description, candidate.description) >= 0.6,
  );

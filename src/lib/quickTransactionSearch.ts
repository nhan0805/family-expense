import type { TransactionSearchResponse } from './ai';
import { normalizeText, type CatalogItem } from './domain';

type QuickSearchCatalog = {
  purposes: CatalogItem[];
  expenseTypes: CatalogItem[];
  paymentMethods: CatalogItem[];
};

const commonWords = new Set([
  'mua', 'chi', 'phi', 'tien', 'ra', 'vao', 'giao', 'dich', 'khoan', 'cac',
  'cho', 'trong', 'tu', 'den', 'tren', 'duoi', 'toi', 'it', 'nhat', 'la',
  'va', 'voi', 'cua', 'thang', 'nam', 'ngay', 'buy', 'purchase', 'spending',
  'expense', 'money', 'out', 'in', 'income', 'transaction', 'transactions',
  'for', 'during', 'from', 'to', 'over', 'under', 'at', 'least', 'month',
  'year', 'actual', 'planned', 'and', 'the',
]);

const transactionTypeTerms = [
  { phrase: 'chi tieu', value: 'Chi tiêu' as const },
  { phrase: 'tien ra', value: 'Chi tiêu' as const },
  { phrase: 'mua', value: 'Chi tiêu' as const },
  { phrase: 'purchase', value: 'Chi tiêu' as const },
  { phrase: 'spending', value: 'Chi tiêu' as const },
  { phrase: 'thu nhap', value: 'Thu nhập' as const },
  { phrase: 'tien vao', value: 'Thu nhập' as const },
  { phrase: 'income', value: 'Thu nhập' as const },
];
const statusTerms = [
  { phrase: 'thuc te', value: 'Thực tế' as const },
  { phrase: 'actual', value: 'Thực tế' as const },
  { phrase: 'du kien', value: 'Dự kiến' as const },
  { phrase: 'planned', value: 'Dự kiến' as const },
];

const hasPhrase = (words: string[], phrase: string) => {
  const phraseWords = phrase.split(' ');
  return words.some((_, index) =>
    phraseWords.every((word, offset) => words[index + offset] === word),
  );
};

const matchingCatalogItems = (words: string[], items: CatalogItem[]) =>
  items.filter((item) =>
    [item.name, item.nameEn]
      .filter((value): value is string => Boolean(value))
      .some((value) => hasPhrase(words, normalizeText(value))),
  );

const addTokens = (target: Set<string>, value: string) => {
  normalizeText(value)
    .split(' ')
    .filter(Boolean)
    .forEach((word) => target.add(word));
};

export function getQuickTransactionSearch(
  text: string,
  language: 'vi' | 'en',
  catalog: QuickSearchCatalog,
): TransactionSearchResponse | null {
  const words = normalizeText(text).split(' ').filter(Boolean);
  if (!words.length) return null;

  const matchedPurposes = matchingCatalogItems(words, catalog.purposes);
  const matchedExpenseTypes = matchingCatalogItems(words, catalog.expenseTypes);
  const matchedPaymentMethods = matchingCatalogItems(words, catalog.paymentMethods);
  const matchedTypeTerms = transactionTypeTerms.filter((term) => hasPhrase(words, term.phrase));
  const matchedStatusTerms = statusTerms.filter((term) => hasPhrase(words, term.phrase));
  const typeValues = new Set(matchedTypeTerms.map((term) => term.value));
  const statusValues = new Set(matchedStatusTerms.map((term) => term.value));
  if (typeValues.size > 1 || statusValues.size > 1) return null;

  const monthIndex = words.findIndex((word) => word === 'thang' || word === 'month');
  const monthValue = monthIndex >= 0 ? Number(words[monthIndex + 1]) : NaN;
  const month = Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 12
    ? monthValue
    : null;
  const yearValue = words.find((word) => /^20\d{2}$/.test(word));
  const year = yearValue ? Number(yearValue) : null;

  const allowedWords = new Set(commonWords);
  matchedTypeTerms.forEach((term) => addTokens(allowedWords, term.phrase));
  matchedStatusTerms.forEach((term) => addTokens(allowedWords, term.phrase));
  [...matchedPurposes, ...matchedExpenseTypes, ...matchedPaymentMethods]
    .flatMap((item) =>
      [item.name, item.nameEn].filter((value): value is string => Boolean(value)),
    )
    .forEach((value) => addTokens(allowedWords, value));
  const unknownWords = words.filter((word) => {
    if (allowedWords.has(word)) return false;
    if (month !== null && word === String(month)) return false;
    if (year !== null && word === String(year)) return false;
    return true;
  });
  if (unknownWords.length) return null;

  const hasStructuredFilter = Boolean(
    matchedPurposes.length ||
    matchedExpenseTypes.length ||
    matchedPaymentMethods.length ||
    typeValues.size ||
    statusValues.size ||
    month !== null ||
    year !== null,
  );
  if (!hasStructuredFilter) return null;

  const transactionType = typeValues.values().next().value;
  const status = statusValues.values().next().value;
  return {
    filters: {
      query: '',
      transactionType: transactionType || (matchedExpenseTypes.length ? 'Chi tiêu' : null),
      status: status || null,
      purposeIds: matchedPurposes.map((item) => item.id),
      expenseTypeIds: matchedExpenseTypes.map((item) => item.id),
      paymentMethodIds: matchedPaymentMethods.map((item) => item.id),
      amountMin: null,
      amountMax: null,
      month,
      year,
      dateFrom: null,
      dateTo: null,
      sort: 'date-desc',
    },
    explanation: language === 'en'
      ? 'Quickly applied the matching structured filters.'
      : 'Đã nhận diện nhanh và áp dụng các bộ lọc phù hợp.',
  };
}

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
  'va', 'voi', 'cua', 'thang', 'nam', 'ngay', 'tat', 'ca', 'tru', 'ngoai',
  'khong', 'bao', 'gom', 'bo', 'qua', 'tinh', 'loai', 'except', 'excluding', 'without',
  'exclude', 'not', 'including', 'buy', 'purchase', 'spending',
  'expense', 'money', 'out', 'in', 'income', 'transaction', 'transactions',
  'for', 'during', 'from', 'to', 'over', 'under', 'at', 'least', 'month',
  'year', 'actual', 'planned', 'and', 'the', 'danh', 'muc', 'loai', 'purpose',
  'category', 'type',
]);

const transactionTypeTerms = [
  { phrase: 'chi tieu', value: 'Chi tiêu' as const },
  { phrase: 'tien ra', value: 'Chi tiêu' as const },
  { phrase: 'mua', value: 'Chi tiêu' as const },
  { phrase: 'purchase', value: 'Chi tiêu' as const },
  { phrase: 'spending', value: 'Chi tiêu' as const },
  { phrase: 'expense', value: 'Chi tiêu' as const },
  { phrase: 'expenses', value: 'Chi tiêu' as const },
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

const findPhraseStart = (words: string[], phrase: string) => {
  const phraseWords = phrase.split(' ');
  return words.findIndex((_, index) =>
    phraseWords.every((word, offset) => words[index + offset] === word),
  );
};

const hasAnyPhrase = (words: string[], phrases: string[]) =>
  phrases.some((phrase) => hasPhrase(words, phrase));

const purposeContextPhrases = ['cho', 'for', 'muc dich', 'purpose'];
const expenseTypeContextPhrases = ['danh muc', 'loai chi phi', 'category', 'expense type'];

const catalogLabelsOverlap = (left: CatalogItem, right: CatalogItem) => {
  const leftLabels = [left.name, left.nameEn]
    .filter((value): value is string => Boolean(value))
    .map(normalizeText);
  const rightLabels = [right.name, right.nameEn]
    .filter((value): value is string => Boolean(value))
    .map(normalizeText);
  return leftLabels.some((label) => rightLabels.includes(label));
};

const resolveAmbiguousCatalogMatches = (
  words: string[],
  purposes: CatalogItem[],
  expenseTypes: CatalogItem[],
) => {
  const purposeContext = hasAnyPhrase(words, purposeContextPhrases);
  const expenseTypeContext = hasAnyPhrase(words, expenseTypeContextPhrases);
  const preferPurpose = purposeContext && !expenseTypeContext;
  const preferExpenseType = expenseTypeContext && !purposeContext;

  if (!preferPurpose && !preferExpenseType && (purposeContext || expenseTypeContext)) {
    return { purposes, expenseTypes };
  }

  const overlappingExpenseTypeIds = new Set(
    expenseTypes
      .filter((expenseType) => purposes.some((purpose) => catalogLabelsOverlap(purpose, expenseType)))
      .map((expenseType) => expenseType.id),
  );
  const overlappingPurposeIds = new Set(
    purposes
      .filter((purpose) => expenseTypes.some((expenseType) => catalogLabelsOverlap(purpose, expenseType)))
      .map((purpose) => purpose.id),
  );

  if (preferPurpose || (!preferExpenseType && !purposeContext && !expenseTypeContext)) {
    return {
      purposes,
      expenseTypes: expenseTypes.filter((item) => !overlappingExpenseTypeIds.has(item.id)),
    };
  }
  return {
    purposes: purposes.filter((item) => !overlappingPurposeIds.has(item.id)),
    expenseTypes,
  };
};

const exclusionMarkers = [
  ['tru'],
  ['ngoai', 'tru'],
  ['khong', 'gom'],
  ['khong', 'bao', 'gom'],
  ['loai', 'tru'],
  ['bo', 'qua'],
  ['khong', 'tinh'],
  ['except'],
  ['excluding'],
  ['without'],
  ['exclude'],
  ['not', 'including'],
];

const isExcluded = (words: string[], item: CatalogItem) =>
  [item.name, item.nameEn]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      const start = findPhraseStart(words, normalizeText(value));
      if (start < 0) return false;
      return exclusionMarkers.some((marker) => {
        const markerStart = start - marker.length - 3;
        return Array.from({ length: 4 }, (_, offset) => markerStart + offset).some(
          (index) =>
            index >= 0 &&
            marker.every((word, markerOffset) => words[index + markerOffset] === word),
        );
      });
    });

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
  const resolvedCatalogMatches = resolveAmbiguousCatalogMatches(words, matchedPurposes, matchedExpenseTypes);
  const resolvedPurposes = resolvedCatalogMatches.purposes;
  const resolvedExpenseTypes = resolvedCatalogMatches.expenseTypes;
  const matchedPaymentMethods = matchingCatalogItems(words, catalog.paymentMethods);
  const excludedPurposes = resolvedPurposes.filter((item) => isExcluded(words, item));
  const excludedExpenseTypes = resolvedExpenseTypes.filter((item) => isExcluded(words, item));
  const excludedPaymentMethods = matchedPaymentMethods.filter((item) => isExcluded(words, item));
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
  [...resolvedPurposes, ...resolvedExpenseTypes, ...matchedPaymentMethods]
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
    resolvedExpenseTypes.length ||
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
      transactionType: transactionType || (resolvedExpenseTypes.length ? 'Chi tiêu' : null),
      status: status || null,
      purposeIds: resolvedPurposes.filter((item) => !excludedPurposes.some((excluded) => excluded.id === item.id)).map((item) => item.id),
      expenseTypeIds: resolvedExpenseTypes.filter((item) => !excludedExpenseTypes.some((excluded) => excluded.id === item.id)).map((item) => item.id),
      paymentMethodIds: matchedPaymentMethods.filter((item) => !excludedPaymentMethods.some((excluded) => excluded.id === item.id)).map((item) => item.id),
      excludePurposeIds: excludedPurposes.map((item) => item.id),
      excludeExpenseTypeIds: excludedExpenseTypes.map((item) => item.id),
      excludePaymentMethodIds: excludedPaymentMethods.map((item) => item.id),
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

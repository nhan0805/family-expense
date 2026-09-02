const moneyPattern =
  /\b\d[\d.,]*(?:\s*(?:k|nghìn|ngàn|triệu|tỷ|đ|đồng|vnđ|vnd))\b/giu;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalizeAiDescription(
  description: string,
  paymentMethodNames: string[] = [],
) {
  const paymentNames = [
    ...paymentMethodNames,
    'tiền mặt',
    'thẻ tín dụng',
    'thẻ ghi nợ',
    'chuyển khoản',
    'ví điện tử',
    'thẻ',
  ]
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const normalizedPaymentNames = paymentNames.join('|');
  const paymentSuffix = normalizedPaymentNames
    ? new RegExp(
        `\\s+(?:(?:thanh toán\\s+)?(?:bằng|qua|dùng)\\s+|thanh toán\\s+)(?:${normalizedPaymentNames})(?:\\s*[.,!?])?$`,
        'iu',
      )
    : null;

  let result = description.replace(/\s+/g, ' ').trim();
  result = result.replace(moneyPattern, ' ');
  result = result.replace(/\s*[-–—:|]\s*/g, ' ');
  if (paymentSuffix) result = result.replace(paymentSuffix, ' ');
  result = result.replace(/\s+/g, ' ').trim();
  if (!result) return description.replace(/\s+/g, ' ').trim();

  return result.charAt(0).toLocaleUpperCase('vi-VN') + result.slice(1);
}

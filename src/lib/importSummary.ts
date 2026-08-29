export function formatImportCheckSummary(
  fileName: string,
  validCount: number,
  duplicateCount: number,
  errorCount: number,
) {
  const parts = [
    `${validCount.toLocaleString('vi-VN')} giao dịch hợp lệ`,
    duplicateCount > 0
      ? `${duplicateCount.toLocaleString('vi-VN')} giao dịch có thể trùng`
      : '',
    errorCount > 0 ? `${errorCount.toLocaleString('vi-VN')} dòng có lỗi` : '',
  ].filter(Boolean);

  const result = parts.join(', ');
  return errorCount === 0
    ? `File “${fileName}” đã sẵn sàng: ${result}.`
    : `Đã kiểm tra file “${fileName}”: ${result}. Vui lòng xem chi tiết bên dưới.`;
}

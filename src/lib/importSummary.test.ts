import { describe, expect, it } from 'vitest';
import { formatImportCheckSummary } from './importSummary';

describe('formatImportCheckSummary', () => {
  it('thông báo rõ file đã sẵn sàng khi mọi dòng hợp lệ', () => {
    expect(formatImportCheckSummary('giao-dich.xlsx', 64, 0, 0)).toBe(
      'File “giao-dich.xlsx” đã sẵn sàng: 64 giao dịch hợp lệ.',
    );
  });

  it('nêu rõ dòng trùng và lỗi cần xem lại', () => {
    expect(formatImportCheckSummary('giao-dich.xlsx', 60, 2, 2)).toBe(
      'Đã kiểm tra file “giao-dich.xlsx”: 60 giao dịch hợp lệ, 2 giao dịch có thể trùng, 2 dòng có lỗi. Vui lòng xem chi tiết bên dưới.',
    );
  });
});

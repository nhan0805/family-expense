import { describe, expect, it } from 'vitest';
import { normalizeAiDescription } from './description';

describe('Chuẩn hóa nội dung giao dịch AI', () => {
  it('loại số tiền và phương thức thanh toán khỏi nội dung', () => {
    expect(normalizeAiDescription('ăn tiệm 190k bằng thẻ', ['Thẻ'])).toBe(
      'Ăn tiệm',
    );
  });

  it('giữ lại chi tiết cốt lõi và chuẩn hóa khoảng trắng', () => {
    expect(
      normalizeAiDescription('  mua sữa cho Haku 450 nghìn  ', [
        'Chuyển khoản',
      ]),
    ).toBe('Mua sữa cho Haku');
  });

  it('không làm rỗng nội dung nếu câu chỉ chứa metadata', () => {
    expect(normalizeAiDescription('190k bằng thẻ', ['Thẻ'])).toBe(
      '190k bằng thẻ',
    );
  });
});

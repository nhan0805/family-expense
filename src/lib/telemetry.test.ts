import { describe, expect, it } from 'vitest';
import { getClientErrorCode } from './telemetry';

describe('telemetry', () => {
  it('chỉ phát mã lỗi an toàn thay vì nội dung có thể chứa dữ liệu người dùng', () => {
    expect(getClientErrorCode(new TypeError('email@example.com và số tiền 300000'))).toBe('TypeError');
    expect(getClientErrorCode({ message: 'private details' })).toBe('UnknownError');
  });
});

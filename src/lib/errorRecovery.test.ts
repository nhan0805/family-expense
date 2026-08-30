import { describe, expect, it } from 'vitest';
import { shouldRetryQuery, userFacingError } from './errorRecovery';

describe('xử lý lỗi và retry', () => {
  it('đổi lỗi mạng thành thông báo tiếng Việt', () => {
    expect(userFacingError(new Error('Failed to fetch'))).toContain('kết nối mạng');
  });

  it('phân biệt lỗi quyền và phiên đăng nhập', () => {
    expect(userFacingError(new Error('42501 permission denied'))).toContain('quyền');
    expect(userFacingError(new Error('JWT expired'))).toContain('Phiên đăng nhập');
  });

  it('không retry lỗi cố định hoặc quá số lần', () => {
    expect(shouldRetryQuery(0, new Error('FORBIDDEN'))).toBe(false);
    expect(shouldRetryQuery(2, new Error('network'))).toBe(false);
    expect(shouldRetryQuery(0, new Error('temporary server error'))).toBe(true);
  });
});

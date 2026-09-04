import { describe, expect, it } from 'vitest';
import { authErrorMessage, shouldRetryQuery, userFacingError } from './errorRecovery';

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

  it('dịch lỗi xác thực phổ biến và không lộ thông báo provider', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe('Email hoặc mật khẩu không đúng.');
    expect(authErrorMessage(new Error('Invalid login credentials'), true)).toBe('The email or password is incorrect.');
    expect(authErrorMessage(new Error('internal provider detail'))).toBe('Không thể hoàn tất yêu cầu xác thực. Vui lòng thử lại.');
  });

  it('dùng fallback thay vì lộ lỗi backend không nhận diện', () => {
    expect(userFacingError(new Error('internal provider detail'), 'Không thể tải dữ liệu.')).toBe('Không thể tải dữ liệu.');
  });
});

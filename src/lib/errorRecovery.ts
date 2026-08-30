const messageOf = (error: unknown) => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error)
    return String(error.message || '');
  return '';
};

export const isOffline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

export function userFacingError(
  error: unknown,
  fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.',
) {
  const message = messageOf(error);
  const normalized = message.toLowerCase();
  if (
    isOffline() ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('fetch failed')
  )
    return 'Không thể kết nối mạng. Hãy kiểm tra Internet rồi thử lại.';
  if (
    normalized.includes('jwt') ||
    normalized.includes('session') ||
    normalized.includes('token')
  )
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử lại.';
  if (
    normalized.includes('42501') ||
    normalized.includes('forbidden') ||
    normalized.includes('permission denied') ||
    normalized.includes('not authorized')
  )
    return 'Bạn không có quyền thực hiện thao tác này.';
  if (
    normalized.includes('404') ||
    normalized.includes('not found') ||
    normalized.includes('không tìm thấy')
  )
    return 'Không tìm thấy dữ liệu hoặc dữ liệu đã bị thay đổi.';
  return message || fallback;
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= 2) return false;
  const normalized = messageOf(error).toLowerCase();
  if (
    normalized.includes('jwt') ||
    normalized.includes('permission') ||
    normalized.includes('forbidden') ||
    normalized.includes('42501') ||
    normalized.includes('404') ||
    normalized.includes('not found')
  )
    return false;
  return true;
}

const messageOf = (error: unknown) => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error)
    return String(error.message || '');
  return '';
};

export function authErrorMessage(error: unknown, english = false) {
  const normalized = messageOf(error).toLowerCase();
  const message = (vi: string, en: string) => english ? en : vi;
  if (
    isOffline() ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('fetch failed')
  )
    return message(
      'Không thể kết nối mạng. Hãy kiểm tra Internet rồi thử lại.',
      'Could not connect to the network. Check your Internet connection and try again.',
    );
  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid_credentials') ||
    normalized.includes('email or password')
  )
    return message('Email hoặc mật khẩu không đúng.', 'The email or password is incorrect.');
  if (normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed'))
    return message('Email chưa được xác nhận. Hãy kiểm tra hộp thư của bạn.', 'Please confirm your email before logging in.');
  if (
    normalized.includes('user already registered') ||
    normalized.includes('already registered') ||
    normalized.includes('user_exists')
  )
    return message('Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.', 'This email is already registered. Log in or use another email.');
  if (normalized.includes('rate limit') || normalized.includes('too many requests'))
    return message('Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.', 'Too many attempts. Please try again later.');
  if (normalized.includes('password') && (normalized.includes('weak') || normalized.includes('short') || normalized.includes('characters')))
    return message('Mật khẩu chưa đủ mạnh. Hãy chọn mật khẩu dài hơn.', 'Choose a stronger password and try again.');
  return message('Không thể hoàn tất yêu cầu xác thực. Vui lòng thử lại.', 'Authentication failed. Please try again.');
}

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
  return fallback;
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

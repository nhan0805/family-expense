import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { authErrorMessage } from '../lib/errorRecovery';
import { AuthShell } from '../components/AuthShell';

export function ResetPassword() {
  const { language } = useLanguage(); const en = language === 'en';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [fieldError, setFieldError] = useState<'password' | 'confirmation' | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(en ? 'Verifying link…' : 'Đang xác minh liên kết…');

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;
      let error: unknown = null;
      try {
        const result = await supabase.auth.getSession();
        session = result.data.session;
        error = result.error;
      } catch (sessionError) {
        error = sessionError;
      }
      if (!active) return;
      if (error || !session) {
        setMessage(error ? authErrorMessage(error, en) : (en ? 'The password reset link is invalid or expired.' : 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'));
        return;
      }
      setReady(true);
      setMessage('');
    };
    void checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === 'PASSWORD_RECOVERY' && session) {
        setReady(true);
        setMessage('');
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [en]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setFieldError('password');
      setMessage(en ? 'Password must be at least 8 characters.' : 'Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmation) {
      setFieldError('confirmation');
      setMessage(en ? 'Passwords do not match.' : 'Hai mật khẩu chưa khớp.');
      return;
    }
    setFieldError(null);
    setBusy(true);
    setMessage(en ? 'Updating password…' : 'Đang cập nhật mật khẩu…');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(authErrorMessage(error, en));
        return;
      }
      navigate('/', { replace: true });
    } catch (error) {
      setMessage(authErrorMessage(error, en));
    } finally {
      setBusy(false);
    }
  };

  return <AuthShell>
    <form className="space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-extrabold">{en ? 'Reset password' : 'Đặt lại mật khẩu'}</h1>
      {ready && <>
        <label><span className="label">{en ? 'New password' : 'Mật khẩu mới'}</span><span className="relative block"><input className="field pr-12" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required aria-invalid={fieldError === 'password'} aria-describedby={fieldError === 'password' ? 'reset-message' : undefined} value={password} onChange={(event) => { setPassword(event.target.value); setFieldError(null); }} /><button type="button" className="icon-button absolute inset-y-0 right-1" aria-label={showPassword ? (en ? 'Hide password' : 'Ẩn mật khẩu') : (en ? 'Show password' : 'Hiện mật khẩu')} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></span></label>
        <label><span className="label">{en ? 'Confirm new password' : 'Nhập lại mật khẩu mới'}</span><span className="relative block"><input className="field pr-12" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" minLength={8} required aria-invalid={fieldError === 'confirmation'} aria-describedby={fieldError === 'confirmation' ? 'reset-message' : undefined} value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setFieldError(null); }} /><button type="button" className="icon-button absolute inset-y-0 right-1" aria-label={showConfirmation ? (en ? 'Hide confirmation' : 'Ẩn mật khẩu xác nhận') : (en ? 'Show confirmation' : 'Hiện mật khẩu xác nhận')} aria-pressed={showConfirmation} onClick={() => setShowConfirmation((value) => !value)}>{showConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></span></label>
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? (en ? 'Updating…' : 'Đang cập nhật…') : (en ? 'Save new password' : 'Lưu mật khẩu mới')}</button>
      </>}
      {message && <p id="reset-message" role="status" className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted)]" aria-live="polite">{message}</p>}
      {!ready && <Link className="text-sm font-semibold text-[var(--primary)]" to="/dang-nhap">{en ? 'Back to log in' : 'Quay lại đăng nhập'}</Link>}
    </form>
  </AuthShell>;
}

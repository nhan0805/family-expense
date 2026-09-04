import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { authErrorMessage } from '../lib/errorRecovery';

type Mode = 'login' | 'signup' | 'magic' | 'forgot';

export function Login() {
  const { language } = useLanguage(); const en = language === 'en';
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const changeMode = (nextMode: Mode) => {
    setMessage('');
    setMode(nextMode);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setMessage(en ? 'Enter your email.' : 'Vui lòng nhập email.');
      return;
    }
    if (mode !== 'magic' && mode !== 'forgot' && password.length < 6) {
      setMessage(en ? 'Password must be at least 6 characters.' : 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    setBusy(true);
    setMessage(en ? 'Processing…' : 'Đang xử lý…');

    if (!isSupabaseConfigured) {
      setBusy(false);
      setMessage(en ? 'Supabase is not configured.' : 'Ứng dụng chưa được cấu hình Supabase.');
      return;
    }

    try {
      const origin = window.location.origin;
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/dat-lai-mat-khau`,
        });
        if (error) {
          setMessage(authErrorMessage(error, en));
          return;
        }
        setMessage(en ? 'Password reset link sent. Check your email.' : 'Đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra email.');
        return;
      }

      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'signup'
          ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/` } })
          : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/` } });

      if (result.error) {
        setMessage(authErrorMessage(result.error, en));
        return;
      }
      if (mode === 'magic') {
        setMessage(en ? 'Magic link sent. Check your email.' : 'Đã gửi liên kết đăng nhập. Vui lòng kiểm tra email.');
        return;
      }
      if (mode === 'signup' && !result.data.session) {
        setMessage(en ? 'Account created. Confirm your email before logging in.' : 'Tài khoản đã được tạo. Vui lòng xác nhận email trước khi đăng nhập.');
        return;
      }
      const from = (location.state as { from?: string } | null)?.from || '/';
      navigate(from, { replace: true });
    } catch (error) {
      setMessage(authErrorMessage(error, en));
    } finally {
      setBusy(false);
    }
  };

  const title = en ? (mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Magic link' : 'Forgot password') : (mode === 'login' ? 'Đăng nhập' : mode === 'signup' ? 'Tạo tài khoản' : mode === 'magic' ? 'Liên kết đăng nhập' : 'Quên mật khẩu');

  return <main className="grid min-h-screen place-items-center bg-[#f6f7f2] p-4 dark:bg-[#282a36]">
    <form className="card w-full max-w-md space-y-4 p-7" onSubmit={submit}>
      <p className="text-xs font-bold tracking-widest text-[#137050] dark:text-[#bd93f9]">FAMILY EXPENSE</p>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {mode === 'forgot' && <p className="text-sm text-gray-500 dark:text-gray-400">{en ? 'Enter your account email to receive a password reset link.' : 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.'}</p>}
      <label><span className="label">Email</span><input className="field" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {mode !== 'magic' && mode !== 'forgot' && <label><span className="label">{en ? 'Password' : 'Mật khẩu'}</span><input className="field" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
      <div className="pt-2">
        <button className="btn-primary w-full" disabled={busy}>{busy ? (en ? 'Processing…' : 'Đang xử lý…') : mode === 'forgot' ? (en ? 'Send reset link' : 'Gửi liên kết đặt lại') : (en ? 'Continue' : 'Tiếp tục')}</button>
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" onClick={() => changeMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? (en ? 'Already have an account' : 'Đã có tài khoản') : (en ? 'Sign up' : 'Đăng ký')}</button>
        {mode === 'login' ? <button type="button" onClick={() => changeMode('forgot')}>{en ? 'Forgot password?' : 'Quên mật khẩu?'}</button> : <button type="button" onClick={() => changeMode('login')}>{en ? 'Log in' : 'Đăng nhập'}</button>}
        {mode === 'login' && <button type="button" onClick={() => changeMode('magic')}>Magic link</button>}
      </div>
    </form>
  </main>;
}

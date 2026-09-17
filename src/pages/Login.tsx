import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, TrendingUp, WalletCards } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState<'email' | 'password' | null>(null);
  const [busy, setBusy] = useState(false);

  const changeMode = (nextMode: Mode) => {
    setMessage('');
    setFieldError(null);
    setShowPassword(false);
    setMode(nextMode);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setFieldError('email');
      setMessage(en ? 'Enter your email.' : 'Vui lòng nhập email.');
      return;
    }
    if (mode !== 'magic' && mode !== 'forgot' && password.length < 6) {
      setFieldError('password');
      setMessage(en ? 'Password must be at least 6 characters.' : 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    setFieldError(null);
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
  const modeEyebrow = en
    ? mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Start simply' : mode === 'magic' ? 'Passwordless sign in' : 'Recover access'
    : mode === 'login' ? 'Chào mừng bạn trở lại' : mode === 'signup' ? 'Bắt đầu thật đơn giản' : mode === 'magic' ? 'Đăng nhập không cần mật khẩu' : 'Khôi phục quyền truy cập';
  const formDescription = en
    ? mode === 'login' || mode === 'signup'
      ? 'A clear view of your family’s money, one transaction at a time.'
      : mode === 'magic'
        ? 'Enter your email and we will send you a sign-in link.'
        : 'Enter your account email to receive a password reset link.'
    : mode === 'login' || mode === 'signup'
      ? 'Theo dõi tài chính gia đình rõ ràng, từng giao dịch một.'
      : mode === 'magic'
        ? 'Nhập email để nhận liên kết đăng nhập.'
        : 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.';
  const featureCards = [
    { icon: WalletCards, title: en ? 'One clear view' : 'Một góc nhìn rõ ràng', body: en ? 'Income, expenses and assets' : 'Thu, chi và tài sản' },
    { icon: TrendingUp, title: en ? 'Stay on track' : 'Luôn chủ động', body: en ? 'Simple, useful insights' : 'Thông tin vừa đủ dùng' },
    { icon: ShieldCheck, title: en ? 'Made for families' : 'Dành cho gia đình', body: en ? 'Shared with the right people' : 'Chia sẻ đúng người' },
  ];

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 size-[28rem] rounded-full bg-[var(--primary-soft)] opacity-70 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 -z-10 size-[25rem] rounded-full bg-[var(--surface-muted)] opacity-60 blur-3xl" aria-hidden="true" />

      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(27rem,31rem)] lg:gap-16">
        <section className="hidden max-w-xl lg:block" aria-labelledby="auth-hero-title">
          <div className="mb-10 flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true"><WalletCards size={22} /></span>
            <p className="brand-wordmark text-sm">FAMILY FINANCE</p>
          </div>
          <p className="mb-4 text-xs font-extrabold uppercase tracking-[.18em] text-[var(--primary)]">
            {en ? 'A calmer way to manage money' : 'Quản lý tài chính nhẹ nhàng hơn'}
          </p>
          <h2 id="auth-hero-title" className="max-w-lg text-4xl font-black leading-[1.08] tracking-[-.045em] text-[var(--text)] xl:text-5xl">
            {en ? <>Clarity for every <span className="text-[var(--primary)]">family decision.</span></> : <>Rõ ràng từng khoản, <span className="text-[var(--primary)]">chủ động mỗi ngày.</span></>}
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[var(--muted)]">
            {en ? 'A simple place to follow income, expenses, savings and gold without losing sight of the bigger picture.' : 'Một nơi đơn giản để theo dõi thu nhập, chi tiêu, sổ tiết kiệm và vàng mà không bỏ quên bức tranh tổng thể.'}
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {featureCards.map(({ icon: Icon, title: featureTitle, body }) => (
              <div key={featureTitle} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <span className="mb-5 grid size-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]" aria-hidden="true"><Icon size={17} /></span>
                <p className="text-sm font-bold text-[var(--text)]">{featureTitle}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card relative w-full max-w-[31rem] justify-self-end overflow-hidden rounded-[1.75rem] border-[color-mix(in_srgb,var(--border)_90%,transparent)] p-5 shadow-[var(--shadow-card-hover)] sm:p-8 lg:p-9" aria-labelledby="auth-form-title">
          <div className="absolute inset-x-0 top-0 h-1 bg-[var(--primary)]" aria-hidden="true" />
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="brand-mark" aria-hidden="true"><WalletCards size={22} /></span>
            <p className="brand-wordmark text-sm">FAMILY FINANCE</p>
          </div>

          <div className="mb-7">
            <p className="text-sm font-bold text-[var(--primary)]">{modeEyebrow}</p>
            <h1 id="auth-form-title" className="mt-2 text-3xl font-black tracking-[-.035em] sm:text-[2.15rem]">{title}</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{formDescription}</p>
          </div>

          {(mode === 'login' || mode === 'signup') && (
            <div className="mb-7 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-1" role="group" aria-label={en ? 'Authentication mode' : 'Chế độ xác thực'}>
              <button type="button" aria-pressed={mode === 'login'} className={`min-h-11 rounded-xl px-3 text-sm font-bold transition ${mode === 'login' ? 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'}`} onClick={() => changeMode('login')}>{en ? 'Log in' : 'Đăng nhập'}</button>
              <button type="button" aria-pressed={mode === 'signup'} className={`min-h-11 rounded-xl px-3 text-sm font-bold transition ${mode === 'signup' ? 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'}`} onClick={() => changeMode('signup')}>{en ? 'Create account' : 'Tạo tài khoản'}</button>
            </div>
          )}

          <form className="space-y-5" onSubmit={submit}>
            <label htmlFor="auth-email" className="block">
              <span className="label">Email</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} aria-hidden="true" />
                <input id="auth-email" name="email" className="field min-h-12 pl-10" type="email" autoComplete="email" required aria-invalid={fieldError === 'email'} aria-describedby={fieldError === 'email' ? 'auth-message' : undefined} value={email} onChange={(event) => { setEmail(event.target.value); setFieldError(null); }} />
              </span>
            </label>
            {mode !== 'magic' && mode !== 'forgot' && (
              <label htmlFor="auth-password" className="block">
                <span className="label">{en ? 'Password' : 'Mật khẩu'}</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} aria-hidden="true" />
                  <input id="auth-password" name="password" className="field min-h-12 pl-10 pr-12" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required aria-invalid={fieldError === 'password'} aria-describedby={fieldError === 'password' ? 'auth-message' : undefined} value={password} onChange={(event) => { setPassword(event.target.value); setFieldError(null); }} />
                  <button type="button" className="icon-button absolute inset-y-0 right-1" aria-label={showPassword ? (en ? 'Hide password' : 'Ẩn mật khẩu') : (en ? 'Show password' : 'Hiện mật khẩu')} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
                </span>
              </label>
            )}
            <div className="pt-1">
              <button type="submit" className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-base" disabled={busy} aria-busy={busy}>
                {busy && <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />}
                {busy ? (en ? 'Processing…' : 'Đang xử lý…') : mode === 'forgot' ? (en ? 'Send reset link' : 'Gửi liên kết đặt lại') : (en ? 'Continue' : 'Tiếp tục')}
              </button>
            </div>
          </form>

          {message && <p id="auth-message" role="status" aria-live="polite" className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-6 text-[var(--muted)]">{message}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4 text-sm">
            {mode === 'login' && <><button className="min-h-11 rounded-lg px-2 font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--primary)]" type="button" onClick={() => changeMode('forgot')}>{en ? 'Forgot password?' : 'Quên mật khẩu?'}</button><button className="min-h-11 rounded-lg px-2 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]" type="button" onClick={() => changeMode('magic')}>Magic link</button></>}
            {(mode === 'signup' || mode === 'magic' || mode === 'forgot') && <button className="min-h-11 rounded-lg px-2 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]" type="button" onClick={() => changeMode('login')}>{en ? 'Back to log in' : 'Về đăng nhập'}</button>}
          </div>
        </section>
      </div>
    </main>
  );
}

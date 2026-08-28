import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type Mode = 'login' | 'signup' | 'magic' | 'forgot';

export function Login() {
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
    setBusy(true);
    setMessage('Đang xử lý…');

    if (!isSupabaseConfigured) {
      setBusy(false);
      setMessage('Ứng dụng chưa được cấu hình Supabase.');
      return;
    }

    const origin = window.location.origin;
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/dat-lai-mat-khau`,
      });
      setBusy(false);
      setMessage(error ? error.message : 'Đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra email.');
      return;
    }

    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : mode === 'signup'
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/` } })
        : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/` } });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === 'magic') {
      setMessage('Đã gửi liên kết đăng nhập. Vui lòng kiểm tra email.');
      return;
    }
    if (mode === 'signup' && !result.data.session) {
      setMessage('Tài khoản đã được tạo. Vui lòng xác nhận email trước khi đăng nhập.');
      return;
    }
    const from = (location.state as { from?: string } | null)?.from || '/';
    navigate(from, { replace: true });
  };

  const title = mode === 'login' ? 'Đăng nhập' : mode === 'signup' ? 'Tạo tài khoản' : mode === 'magic' ? 'Liên kết đăng nhập' : 'Quên mật khẩu';

  return <main className="grid min-h-screen place-items-center bg-[#f6f7f2] p-4 dark:bg-[#0f1814]">
    <form className="card w-full max-w-md space-y-4 p-7" onSubmit={submit}>
      <p className="text-xs font-bold tracking-widest text-[#137050]">FAMILY EXPENSE</p>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {mode === 'forgot' && <p className="text-sm text-gray-500">Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.</p>}
      <label><span className="label">Email</span><input className="field" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {mode !== 'magic' && mode !== 'forgot' && <label><span className="label">Mật khẩu</span><input className="field" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
      <div className="pt-2">
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'forgot' ? 'Gửi liên kết đặt lại' : 'Tiếp tục'}</button>
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" onClick={() => changeMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Đã có tài khoản' : 'Đăng ký'}</button>
        {mode === 'login' ? <button type="button" onClick={() => changeMode('forgot')}>Quên mật khẩu?</button> : <button type="button" onClick={() => changeMode('login')}>Đăng nhập</button>}
        {mode === 'login' && <button type="button" onClick={() => changeMode('magic')}>Magic link</button>}
      </div>
    </form>
  </main>;
}

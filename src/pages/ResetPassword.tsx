import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export function ResetPassword() {
  const { language } = useLanguage(); const en = language === 'en';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(en ? 'Verifying link…' : 'Đang xác minh liên kết…');

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error || !data.session) {
        setMessage(en ? 'The password reset link is invalid or expired.' : 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
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
      setMessage(en ? 'Password must be at least 8 characters.' : 'Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmation) {
      setMessage(en ? 'Passwords do not match.' : 'Hai mật khẩu chưa khớp.');
      return;
    }
    setBusy(true);
    setMessage(en ? 'Updating password…' : 'Đang cập nhật mật khẩu…');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    navigate('/', { replace: true });
  };

  return <main className="grid min-h-screen place-items-center bg-[#f6f7f2] p-4 dark:bg-[#0f1814]">
    <form className="card w-full max-w-md space-y-4 p-7" onSubmit={submit}>
      <p className="text-xs font-bold tracking-widest text-[#137050]">FAMILY EXPENSE</p>
      <h1 className="text-2xl font-extrabold">{en ? 'Reset password' : 'Đặt lại mật khẩu'}</h1>
      {ready && <>
        <label><span className="label">Mật khẩu mới</span><input className="field" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label><span className="label">Nhập lại mật khẩu mới</span><input className="field" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Đang cập nhật…' : 'Lưu mật khẩu mới'}</button>
      </>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {!ready && <Link className="text-sm font-semibold text-[#137050]" to="/dang-nhap">Quay lại đăng nhập</Link>}
    </form>
  </main>;
}

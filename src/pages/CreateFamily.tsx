import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { HousePlus, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

export function CreateFamily() {
  const { authenticated, loading, familyId, createFamily } = useApp();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">Đang tải…</main>
    );
  if (!authenticated)
    return (
      <Navigate to="/dang-nhap" replace state={{ from: '/tao-gia-dinh' }} />
    );
  if (familyId) return <Navigate to="/" replace />;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const result = await createFamily(name);
    setBusy(false);
    if (result) {
      setMessage(result);
      return;
    }
    window.location.assign('/');
  };
  const signOut = async () => {
    setSigningOut(true);
    setMessage('');
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      setMessage(error.message);
      return;
    }
    window.location.assign('/dang-nhap');
  };
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f2] p-4 dark:bg-[#0f1814]">
      <form className="card w-full max-w-lg space-y-5 p-7" onSubmit={submit}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dceee5] text-[#155e46]">
          <HousePlus />
        </div>
        <div>
          <p className="text-xs font-bold tracking-widest text-[#137050]">
            FAMILY EXPENSE
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">Tạo gia đình mới</h1>
          <p className="mt-2 text-sm text-gray-500">
            Bạn sẽ là Chủ gia đình và có thể thêm thành viên sau khi hoàn tất.
          </p>
        </div>
        <label>
          <span className="label">Tên gia đình *</span>
          <input
            className="field"
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Gia đình Nhân"
          />
        </label>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Đang tạo…' : 'Tạo gia đình'}
        </button>
        <button
          type="button"
          className="btn-secondary flex w-full items-center justify-center gap-2"
          disabled={signingOut || busy}
          onClick={() => void signOut()}
        >
          <LogOut size={17} />
          {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </button>
        {message && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {message}
          </p>
        )}
        <p className="text-xs text-gray-500">
          Hệ thống sẽ tạo sẵn mục đích chi, loại chi phí và phương thức thanh
          toán mặc định.
        </p>
      </form>
    </main>
  );
}

import { ArrowRight, Check, House, LoaderCircle, LogOut, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { userFacingError } from '../lib/errorRecovery';
import { AuthShell } from '../components/AuthShell';

export function CreateFamily() {
  const { language, t } = useOptionalLanguage();
  const en = language === 'en';
  const { authenticated, loading, familyId, createFamily } = useApp();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  if (loading)
    return (
      <AuthShell maxWidth="max-w-2xl" showCompactThemeIcon={false}>
        <div className="space-y-5" role="status" aria-live="polite">
          <span className="sr-only">{en ? 'Preparing your family space…' : 'Đang chuẩn bị không gian gia đình…'}</span>
          <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--primary-soft)] motion-reduce:animate-none" aria-hidden="true" />
          <div className="h-9 w-3/4 max-w-sm animate-pulse rounded-lg bg-[var(--surface-muted)] motion-reduce:animate-none" aria-hidden="true" />
          <div className="h-14 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)] motion-reduce:animate-none" aria-hidden="true" />
        </div>
      </AuthShell>
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
    try {
      const result = await createFamily(name);
      if (result) {
        setMessage(result);
        return;
      }
      window.location.assign('/');
    } catch (error) {
      setMessage(userFacingError(error, en ? 'Could not create the family. Please try again.' : 'Không thể tạo gia đình. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    setSigningOut(true);
    setMessage('');
    if (!isSupabaseConfigured) {
      window.location.assign('/dang-nhap');
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      setMessage(userFacingError(error, en ? 'Could not log out. Please try again.' : 'Không thể đăng xuất. Vui lòng thử lại.'));
      return;
    }
    window.location.assign('/dang-nhap');
  };
  const benefits = en
    ? ['Default categories are ready from the start.', 'Add the people you trust after setup.', 'Everyone sees the same family picture.']
    : ['Có sẵn danh mục mặc định ngay từ đầu.', 'Thêm những người bạn tin tưởng sau khi thiết lập.', 'Cả gia đình cùng theo dõi một bức tranh chung.'];

  return (
    <AuthShell maxWidth="max-w-3xl" showCompactThemeIcon={false}>
      <div className="mb-8">
        <div>
          <p className="page-kicker"><Sparkles size={15} aria-hidden="true" />{en ? 'First-time setup' : 'Thiết lập ban đầu'}</p>
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">{en ? 'One small step to get started' : 'Một bước nhỏ để bắt đầu'}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(15rem,.92fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="create-family-title">
          <h1 id="create-family-title" className="page-title text-3xl sm:text-4xl">{en ? 'Create your family space' : 'Tạo không gian gia đình'}</h1>
          <p className="page-subtitle max-w-xl text-base">
            {en ? 'Give your shared finances a home. You will become the family owner and can invite members when everything is ready.' : 'Đặt tên cho không gian tài chính chung. Bạn sẽ là Chủ gia đình và có thể thêm thành viên sau khi hoàn tất.'}
          </p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <div>
              <label htmlFor="create-family-name" className="label">{en ? 'Family name *' : 'Tên gia đình *'}</label>
              <span className="relative block">
                <House className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} aria-hidden="true" />
                <input
                  id="create-family-name"
                  name="familyName"
                  className="field min-h-14 pl-11"
                  autoFocus
                  required
                  maxLength={100}
                  aria-invalid={Boolean(message)}
                  aria-describedby={message ? 'create-family-name-hint create-family-message' : 'create-family-name-hint'}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={en ? 'Example: Nhan family' : 'Ví dụ: Gia đình Nhân'}
                />
              </span>
              <span id="create-family-name-hint" className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                <Sparkles className="mt-0.5 shrink-0 text-[var(--primary)]" size={14} aria-hidden="true" />
                {en ? 'You can change the name later in Family members.' : 'Bạn có thể đổi tên sau trong phần Thành viên gia đình.'}
              </span>
            </div>

            {message && (
              <div id="create-family-message" role="alert" className="inline-feedback inline-feedback-error flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0" aria-hidden="true">!</span>
                <p>{message}</p>
              </div>
            )}

            <button type="submit" className="btn-primary flex min-h-12 w-full items-center justify-center gap-2" disabled={busy}>
              {busy ? <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
              <span>{busy ? (en ? 'Creating…' : 'Đang tạo…') : (en ? 'Create family' : 'Tạo gia đình')}</span>
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]" aria-hidden="true">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span>{en ? 'or' : 'hoặc'}</span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <button
            type="button"
            className="btn-secondary flex min-h-12 w-full items-center justify-center gap-2"
            disabled={signingOut || busy}
            onClick={() => void signOut()}
          >
            <LogOut size={17} aria-hidden="true" />
            {signingOut ? (en ? 'Logging out…' : 'Đang đăng xuất…') : t('logout')}
          </button>
        </section>

        <aside className="rounded-3xl border border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[color-mix(in_srgb,var(--primary-soft)_56%,var(--surface))] p-5 sm:p-6" aria-labelledby="create-family-benefits-title">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm" aria-hidden="true"><UsersRound size={20} /></span>
            <div>
              <h2 id="create-family-benefits-title" className="font-extrabold leading-6">{en ? 'Built for shared money decisions' : 'Cùng nhau quản lý, nhẹ nhàng hơn'}</h2>
              <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{en ? 'A simple starting point for your household.' : 'Một điểm bắt đầu đơn giản cho cả gia đình.'}</p>
            </div>
          </div>

          <ul className="space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-sm leading-5 text-[var(--text)]">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success-strong)]" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] p-3.5">
            <ShieldCheck className="mt-0.5 shrink-0 text-[var(--primary)]" size={18} aria-hidden="true" />
            <p className="text-xs leading-5 text-[var(--muted)]">{en ? 'Your family data stays shared only with the members you add.' : 'Dữ liệu gia đình chỉ được chia sẻ với những thành viên bạn thêm vào.'}</p>
          </div>
        </aside>
      </div>

      <p className="mt-8 border-t border-[var(--border)] pt-5 text-center text-xs leading-5 text-[var(--muted)]">
        {en ? 'You can invite members and adjust categories after this step.' : 'Sau bước này, bạn có thể thêm thành viên và điều chỉnh danh mục.'}
      </p>
    </AuthShell>
  );
}

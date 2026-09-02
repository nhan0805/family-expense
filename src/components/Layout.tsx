import { BookOpen, House, LogOut, Menu, Plus, Tags, UserRound, UsersRound, WalletCards, WifiOff, X } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { PageSkeleton } from './AsyncStates';
import { ThemeSelect } from './ThemeSelect';
import { useLanguage } from '../context/LanguageContext';

const links = [['/', 'overview', House], ['/giao-dich', 'transactions', WalletCards], ['/danh-muc', 'catalogs', Tags], ['/thanh-vien', 'members', UsersRound], ['/du-lieu', 'data', BookOpen]] as const;

export function Layout() {
  const [open, setOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { familyId, familyName, currentUserEmail, loading, authenticated, error, online, reloadApp } = useApp();
  const { t, language } = useLanguage();
  const en = language === 'en';
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isTransactionForm = pathname === '/giao-dich/moi' || /^\/giao-dich\/[^/]+$/.test(pathname);

  useEffect(() => {
    if (open) {
      setMenuMounted(true);
      return;
    }
    if (!menuMounted) return;
    const timeout = window.setTimeout(() => setMenuMounted(false), 180);
    return () => window.clearTimeout(timeout);
  }, [menuMounted, open]);

  if (!loading && !authenticated) return <Navigate to="/dang-nhap" replace state={{ from: pathname }} />;
  if (!loading && authenticated && !familyId && !error) return <Navigate to="/tao-gia-dinh" replace />;

  const signOut = async () => {
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setSigningOut(false);
    if (!signOutError) navigate('/dang-nhap', { replace: true });
  };

  return <div className="app-shell">
    <header className="app-header sticky top-0 z-30 border-b px-4 py-3 backdrop-blur">
      <div className="app-header-inner mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="brand-mark" aria-hidden="true"><WalletCards size={21} /></span>
          <div className="min-w-0">
            <p className="brand-wordmark">FAMILY EXPENSE</p>
            <h1 className="truncate font-bold leading-tight">{familyName}</h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400 md:hidden">{currentUserEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden max-w-64 items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-600 dark:text-gray-300 md:flex"><UserRound size={17} /><span className="truncate">{currentUserEmail}</span></div>
          <button className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 md:flex" disabled={signingOut} onClick={signOut}><LogOut size={18}/>{signingOut ? t('loggingOut') : t('logout')}</button>
          <button className="icon-button md:hidden" aria-label={en ? 'Open menu' : 'Mở trình đơn'} onClick={() => setOpen(true)}><Menu /></button>
        </div>
      </div>
    </header>
    {!online && <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"><WifiOff size={16} />{t('offline')}</div>}
    <div className="mx-auto flex max-w-7xl">
      {menuMounted && <button type="button" className={`app-scrim md:hidden ${open ? 'ui-overlay-enter' : 'ui-overlay-exit'}`} aria-label={en ? 'Close menu overlay' : 'Đóng lớp trình đơn'} onClick={() => setOpen(false)} />}
      <aside className={`app-sidebar ${open ? 'app-sidebar-open ui-drawer-enter fixed inset-y-0 left-0 z-50 flex' : menuMounted ? 'ui-drawer-exit fixed inset-y-0 left-0 z-50 flex' : 'hidden'} w-72 flex-col border-r p-4 md:sticky md:top-[68px] md:flex md:h-[calc(100vh-68px)] md:w-64`}>
        <div className="mb-3 flex items-center justify-between md:hidden">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-gray-500 dark:text-gray-400">{en ? 'Menu' : 'Trình đơn'}</p>
          <button className="icon-button" aria-label={en ? 'Close menu' : 'Đóng trình đơn'} onClick={() => setOpen(false)}><X /></button>
        </div>
        <nav className="mt-1 space-y-1 md:mt-2">{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `app-nav-link flex items-center gap-3 rounded-xl px-3 py-3 font-semibold ${isActive ? 'app-nav-link-active' : ''}`}><Icon size={19} />{t(label)}</NavLink>)}</nav>
        <div className="app-sidebar-footer mt-auto space-y-2 border-t pt-4">
          <ThemeSelect/>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30 md:hidden" disabled={signingOut} onClick={signOut}><LogOut size={19}/>{signingOut ? t('loggingOut') : t('logout')}</button>
        </div>
      </aside>
      <main className="app-main min-w-0 flex-1 p-4 pb-28 sm:p-5 md:p-8 lg:p-9">{loading ? <PageSkeleton label={t('familyLoading')}/> : error ? <div className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert"><p>{error}</p><button type="button" className="btn-secondary mt-3" onClick={reloadApp}>{t('reload')}</button></div> : <div key={pathname} className="ui-enter"><Outlet /></div>}</main>
    </div>
    {!isTransactionForm && <NavLink to="/giao-dich/moi" className="fab fixed bottom-[calc(4.5rem+max(1rem,env(safe-area-inset-bottom)))] right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white md:bottom-7" aria-label={en ? 'Add transaction' : 'Thêm giao dịch'}><Plus /></NavLink>}
    <nav className="app-bottom-nav safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t px-1 pt-1.5 text-[10px] md:hidden">{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `app-bottom-nav-link mx-0.5 flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 font-semibold ${isActive ? 'app-bottom-nav-link-active' : ''}`}><Icon size={20} /><span className="max-w-full truncate">{t(label)}</span></NavLink>)}</nav>
  </div>;
}

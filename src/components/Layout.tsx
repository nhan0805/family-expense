import { BookOpen, House, LogOut, Menu, Plus, Tags, UserRound, UsersRound, WalletCards, WifiOff, X } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { PageSkeleton } from './AsyncStates';
import { ThemeSelect } from './ThemeSelect';

const links = [['/', 'Tổng quan', House], ['/giao-dich', 'Giao dịch', WalletCards], ['/danh-muc', 'Danh mục', Tags], ['/thanh-vien', 'Thành viên', UsersRound], ['/du-lieu', 'Quản lý dữ liệu', BookOpen]] as const;

export function Layout() {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { familyId, familyName, currentUserEmail, loading, authenticated, error, online, reloadApp } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isTransactionForm = pathname === '/giao-dich/moi' || /^\/giao-dich\/[^/]+$/.test(pathname);

  if (!loading && !authenticated) return <Navigate to="/dang-nhap" replace state={{ from: pathname }} />;
  if (!loading && authenticated && !familyId && !error) return <Navigate to="/tao-gia-dinh" replace />;

  const signOut = async () => {
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setSigningOut(false);
    if (!signOutError) navigate('/dang-nhap', { replace: true });
  };

  return <div className="min-h-screen bg-[#f6f7f2] text-[#17352b] dark:bg-[#0f1814] dark:text-[#e7f0eb]">
    <header className="sticky top-0 z-30 border-b border-black/8 bg-[#f6f7f2]/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#0f1814]/95"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-gray-500 dark:text-gray-400">FAMILY EXPENSE</p><h1 className="truncate font-bold">{familyName}</h1><p className="truncate text-xs text-gray-500 dark:text-gray-400 md:hidden">{currentUserEmail}</p></div><div className="flex items-center gap-2"><div className="hidden max-w-64 items-center gap-2 text-sm text-gray-600 dark:text-gray-300 md:flex"><UserRound size={17}/><span className="truncate">{currentUserEmail}</span></div><button className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 md:flex" disabled={signingOut} onClick={signOut}><LogOut size={18}/>{signingOut?'Đang đăng xuất…':'Đăng xuất'}</button><button className="rounded-xl p-2 md:hidden" aria-label="Mở trình đơn" onClick={() => setOpen(true)}><Menu /></button></div></div></header>
    {!online && <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 bg-amber-100 p-2 text-sm text-amber-900"><WifiOff size={16} />Mất kết nối — dữ liệu chưa lưu sẽ không được coi là thành công.</div>}
    <div className="mx-auto flex max-w-7xl"><aside className={`${open ? 'fixed inset-0 z-40 flex' : 'hidden'} w-72 flex-col bg-white p-4 dark:bg-[#17251f] md:sticky md:top-[65px] md:flex md:h-[calc(100vh-65px)] md:w-64`}><button className="ml-auto p-2 md:hidden" aria-label="Đóng trình đơn" onClick={() => setOpen(false)}><X /></button><nav className="mt-5 space-y-1">{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 font-medium ${isActive ? 'bg-[#dceee5] text-[#124e3b] dark:bg-emerald-950/70 dark:text-emerald-200' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}><Icon size={19} />{label}</NavLink>)}</nav><div className="mt-auto space-y-2 border-t border-black/10 pt-4 dark:border-white/10"><ThemeSelect/><button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30 md:hidden" disabled={signingOut} onClick={signOut}><LogOut size={19}/>{signingOut?'Đang đăng xuất…':'Đăng xuất'}</button></div></aside><main className="min-w-0 flex-1 p-4 pb-28 md:p-7">{loading ? <PageSkeleton label="Đang tải dữ liệu gia đình…"/> : error ? <div className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert"><p>{error}</p><button type="button" className="btn-secondary mt-3" onClick={reloadApp}>Thử tải lại</button></div> : <div key={pathname} className="ui-enter"><Outlet /></div>}</main></div>
    {!isTransactionForm && <NavLink to="/giao-dich/moi" className="fixed bottom-[calc(4.5rem+max(1rem,env(safe-area-inset-bottom)))] right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#155e46] text-white shadow-xl md:bottom-7" aria-label="Thêm giao dịch"><Plus /></NavLink>}
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-white px-1 pt-1.5 text-[10px] dark:border-gray-700 dark:bg-[#17251f] md:hidden">{links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mx-0.5 flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 font-medium ${isActive ? 'bg-[#e3f2e9] text-[#137050] dark:bg-emerald-950/60 dark:text-emerald-300' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'}`}><Icon size={20} /><span className="max-w-full truncate">{label}</span></NavLink>)}</nav>
  </div>;
}

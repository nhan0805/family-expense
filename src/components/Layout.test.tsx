import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../context/AppContext';
import { FeedbackProvider } from './Feedback';
import { Layout } from './Layout';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'vi',
    t: (key: string) => ({
      overview: 'Tổng quan',
      transactions: 'Giao dịch',
      budgets: 'Ngân sách',
      catalogs: 'Danh mục',
      members: 'Thành viên',
      data: 'Dữ liệu',
      more: 'Thêm',
      logout: 'Đăng xuất',
      loggingOut: 'Đang đăng xuất…',
      offline: 'Mất kết nối',
      reload: 'Thử tải lại',
      familyLoading: 'Đang tải dữ liệu gia đình…',
    }[key] || key),
  }),
  useOptionalLanguage: () => ({
    language: 'vi',
    t: (key: string) => ({
      budgetNotifications: 'Thông báo ngân sách',
      unreadBudgetNotifications: 'chưa đọc',
      unreadBudgetNotification: 'Chưa đọc',
      allBudgetNotificationsRead: 'Bạn đã xem hết thông báo.',
      markAllRead: 'Đánh dấu đã đọc',
      noBudgetNotifications: 'Chưa có cảnh báo ngân sách.',
      viewTransactions: 'Xem giao dịch',
    }[key] || key),
  }),
}));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('./ThemeSelect', () => ({ ThemeSelect: () => null }));

describe('Layout mobile navigation', () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      currentUserDisplayName: 'Chủ gia đình',
      loading: false,
      authenticated: true,
      error: null,
      online: true,
      reloadApp: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);
  });

  it('đưa Thành viên vào menu Thêm thay vì taskbar mobile', () => {
    render(
      <FeedbackProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="*" element={<div>Trang hiện tại</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>,
    );

    const bottomNav = document.querySelector('nav.app-bottom-nav') as HTMLElement | null;
    expect(bottomNav).toBeInTheDocument();
    expect(within(bottomNav!).getAllByRole('link')).toHaveLength(4);
    expect(within(bottomNav!).queryByRole('link', { name: 'Thành viên' })).not.toBeInTheDocument();
    expect(within(bottomNav!).getByRole('link', { name: 'Danh mục' })).toHaveAttribute('href', '/danh-muc');

    const memberLinks = screen.getAllByRole('link', { name: 'Mở màn hình thành viên của Chủ gia đình' });
    expect(memberLinks).toHaveLength(2);
    expect(memberLinks[0]).toHaveAttribute('href', '/thanh-vien');
    expect(memberLinks[1]).toHaveAttribute('href', '/thanh-vien');

    fireEvent.click(within(bottomNav!).getByRole('button', { name: 'Thêm' }));
    expect(screen.getByRole('link', { name: 'Thành viên' })).toHaveAttribute('href', '/thanh-vien');
  });
});

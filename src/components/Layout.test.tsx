import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../context/AppContext';
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
}));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('./ThemeSelect', () => ({ ThemeSelect: () => null }));

describe('Layout mobile navigation', () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      loading: false,
      authenticated: true,
      error: null,
      online: true,
      reloadApp: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);
  });

  it('đưa Thành viên vào menu Thêm thay vì taskbar mobile', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Trang hiện tại</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const bottomNav = document.querySelector('nav.app-bottom-nav') as HTMLElement | null;
    expect(bottomNav).toBeInTheDocument();
    expect(within(bottomNav!).getAllByRole('link')).toHaveLength(4);
    expect(within(bottomNav!).queryByRole('link', { name: 'Thành viên' })).not.toBeInTheDocument();
    expect(within(bottomNav!).getByRole('link', { name: 'Danh mục' })).toHaveAttribute('href', '/danh-muc');

    fireEvent.click(within(bottomNav!).getByRole('button', { name: 'Thêm' }));
    expect(screen.getByRole('link', { name: 'Thành viên' })).toHaveAttribute('href', '/thanh-vien');
  });
});

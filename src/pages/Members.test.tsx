import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Members } from './Members';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) },
}));

describe('Members', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('cho owner thấy form thêm thành viên', async () => {
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      currentUserId: 'owner-1',
      currentUserRole: 'owner',
      updateFamilyName: vi.fn(),
      deleteFamily: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);
    render(<Members />);
    expect(
      screen.getByRole('heading', { name: 'Gia đình của tôi' }),
    ).toHaveClass('page-title');
    expect(
      screen.getByRole('button', { name: 'Thêm vào gia đình' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Xóa gia đình' }),
    ).toHaveClass('danger-button');
    expect(
      screen.getByRole('heading', { name: 'Xóa gia đình' }),
    ).toHaveClass('dark:text-[#ff5555]');
    expect(document.querySelector('.danger-zone')).toHaveClass('card');
    await waitFor(() =>
      expect(screen.getByText('Danh sách thành viên (0)')).toBeInTheDocument(),
    );
  });

  it('member chỉ xem và không thấy form thêm', async () => {
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'member@example.com',
      currentUserId: 'member-1',
      currentUserRole: 'member',
      updateFamilyName: vi.fn(),
      deleteFamily: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);
    render(<Members />);
    expect(
      screen.queryByRole('button', { name: 'Thêm vào gia đình' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Xóa gia đình' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Chỉ chủ gia đình mới có thể thêm thành viên.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Danh sách thành viên (0)')).toBeInTheDocument(),
    );
  });

  it('hiển thị avatar chữ cái đủ tương phản trong danh sách thành viên', async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: [{
          id: 'member-1',
          user_id: 'member-user-1',
          display_name: 'Nhan',
          email: 'nhan@example.com',
          role: 'member',
          status: 'active',
          created_at: '2026-09-01T00:00:00Z',
        }],
        error: null,
      } as never)
      .mockResolvedValueOnce({ data: true, error: null } as never);
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      currentUserId: 'member-user-1',
      currentUserRole: 'owner',
      updateFamilyName: vi.fn(),
      deleteFamily: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);
    render(<Members />);

    const avatar = await screen.findByText('N', { selector: '.member-avatar' });
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    const currentUserRow = screen.getByRole('article', { name: 'Nhan, tài khoản đang đăng nhập' });
    expect(currentUserRow).toHaveClass('member-row-current');
    expect(within(currentUserRow).getByText('Bạn')).toBeInTheDocument();
  });
});

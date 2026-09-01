import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../context/AppContext';
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
    ).toBeInTheDocument();
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
});

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { FeedbackProvider } from '../components/Feedback';
import { Members } from './Members';

const supabaseMode = vi.hoisted(() => ({ configured: true }));

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseMode.configured;
  },
  supabase: { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) },
}));

describe('Members', () => {
  const renderMembers = () => render(<FeedbackProvider><Members /></FeedbackProvider>);

  afterEach(() => {
    cleanup();
    supabaseMode.configured = true;
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
    renderMembers();
    expect(
      screen.getByRole('heading', { name: 'Thành viên gia đình' }),
    ).toHaveClass('page-title');
    expect(
      screen.getByRole('button', { name: 'Thêm vào gia đình' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Xóa gia đình' }),
    ).toHaveClass('danger-button');
    expect(
      screen.getByRole('heading', { name: 'Xóa gia đình' }),
    ).toHaveClass('text-[var(--danger-strong)]');
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
    renderMembers();
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
    renderMembers();

    const avatar = await screen.findByText('N', { selector: '.member-avatar' });
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    const currentUserRow = screen.getByRole('article', { name: 'Nhan, tài khoản đang đăng nhập' });
    expect(currentUserRow).toHaveClass('member-row-current');
    expect(within(currentUserRow).getByText('Bạn')).toBeInTheDocument();
    const removeButton = within(currentUserRow).getByRole('button', { name: 'Xóa Nhan' });
    expect(removeButton.textContent).toBe('');
    expect(removeButton).toHaveAttribute('title', 'Xóa Nhan');
  });

  it('không giữ loading vô hạn khi chưa có familyId', async () => {
    vi.mocked(useApp).mockReturnValue({
      familyId: '',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      currentUserId: 'owner-1',
      currentUserRole: 'owner',
      updateFamilyName: vi.fn(),
      deleteFamily: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);

    renderMembers();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy gia đình đang hoạt động.'));
    expect(screen.queryByLabelText('Đang tải thành viên')).not.toBeInTheDocument();
  });

  it('hiển thị lỗi khi RPC tải thành viên bị reject', async () => {
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      currentUserId: 'owner-1',
      currentUserRole: 'owner',
      updateFamilyName: vi.fn(),
      deleteFamily: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('network request failed'));

    renderMembers();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Không thể hoàn tất thao tác thành viên.'));
    expect(screen.queryByLabelText('Đang tải thành viên')).not.toBeInTheDocument();
  });

  it('hiển thị lỗi và kết thúc loading khi xóa gia đình bị reject', async () => {
    const deleteFamily = vi.fn().mockRejectedValue(new Error('SUPABASE_REQUEST_TIMEOUT'));
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: [], error: null } as never)
      .mockResolvedValueOnce({ data: true, error: null } as never);
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      currentUserId: 'owner-1',
      currentUserRole: 'owner',
      updateFamilyName: vi.fn(),
      deleteFamily,
    } as unknown as ReturnType<typeof useApp>);

    renderMembers();

    const deleteButton = await screen.findByRole('button', { name: 'Xóa gia đình' });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    fireEvent.click(deleteButton);
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa gia đình' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Hệ thống phản hồi quá lâu');
    expect(deleteFamily).toHaveBeenCalledOnce();
    expect(deleteButton).toBeEnabled();
  });

  it('vẫn gọi RPC xóa khi kiểm tra điều kiện trước đó bị lỗi', async () => {
    const deleteFamily = vi.fn().mockResolvedValue('Không thể xóa gia đình.');
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: [], error: null } as never)
      .mockRejectedValueOnce(new Error('network request failed'));
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      currentUserId: 'owner-1',
      currentUserRole: 'owner',
      updateFamilyName: vi.fn(),
      deleteFamily,
    } as unknown as ReturnType<typeof useApp>);

    renderMembers();

    const deleteButton = await screen.findByRole('button', { name: 'Đang kiểm tra điều kiện xóa…' });
    fireEvent.click(deleteButton);
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa gia đình' }));

    await waitFor(() => expect(deleteFamily).toHaveBeenCalledOnce());
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xóa gia đình.');
  });

  it('cho phép xóa gia đình trong chế độ demo khi không còn giao dịch hoạt động', async () => {
    supabaseMode.configured = false;
    const deleteFamily = vi.fn().mockResolvedValue('Đã xóa gia đình demo.');
    vi.mocked(useApp).mockReturnValue({
      familyId: 'local-family',
      familyName: 'Gia đình demo',
      currentUserEmail: 'demo@family.local',
      currentUserId: 'local-user',
      currentUserRole: 'owner',
      transactions: [],
      updateFamilyName: vi.fn(),
      deleteFamily,
    } as unknown as ReturnType<typeof useApp>);

    renderMembers();

    const deleteButton = await screen.findByRole('button', { name: 'Xóa gia đình' });
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa gia đình' }));

    await waitFor(() => expect(deleteFamily).toHaveBeenCalledOnce());
    expect(await screen.findByRole('alert')).toHaveTextContent('Đã xóa gia đình demo.');
  });

  it('cho nút phản hồi rõ ràng khi gia đình còn giao dịch hoạt động', async () => {
    const deleteFamily = vi.fn();
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: [], error: null } as never)
      .mockResolvedValueOnce({ data: false, error: null } as never);
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-1',
      familyName: 'Gia đình của tôi',
      currentUserEmail: 'owner@example.com',
      currentUserId: 'owner-1',
      currentUserRole: 'owner',
      updateFamilyName: vi.fn(),
      deleteFamily,
    } as unknown as ReturnType<typeof useApp>);

    renderMembers();

    const deleteButton = await screen.findByRole('button', { name: 'Xóa gia đình' });
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Hãy xóa hết giao dịch');
    expect(deleteFamily).not.toHaveBeenCalled();
  });
});

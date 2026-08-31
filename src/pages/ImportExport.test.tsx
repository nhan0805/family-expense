import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApp } from '../context/AppContext';
import type { Transaction } from '../lib/domain';
import { ImportExport } from './ImportExport';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke } },
}));

const mockedUseApp = vi.mocked(useApp);

const appState = (role: 'owner' | 'member') =>
  ({
    familyId: '11111111-1111-4111-8111-111111111111',
    currentUserEmail: 'owner@example.com',
    currentUserId: 'user-1',
    currentUserRole: role,
    transactions: [] as Transaction[],
    purposes: [],
    expenseTypes: [],
    paymentMethods: [],
  }) as unknown as ReturnType<typeof useApp>;

describe('Gửi danh sách giao dịch qua email', () => {
  it('owner gửi tới email tài khoản hiện tại', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    invoke.mockResolvedValue({
      data: { sent: true, transactionCount: 12 },
      error: null,
    });
    render(<ImportExport />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Gửi danh sách giao dịch' }),
    );

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('email-transactions', {
        body: { familyId: '11111111-1111-4111-8111-111111111111' },
      }),
    );
    expect(
      await screen.findByText(
        'Đã gửi 12 giao dịch tới owner@example.com.',
      ),
    ).toBeInTheDocument();
  });

  it('member không được bật nút gửi email', () => {
    mockedUseApp.mockReturnValue(appState('member'));
    render(<ImportExport />);

    expect(screen.getByRole('heading', { name: 'Dữ liệu' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Chế độ')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Gửi danh sách giao dịch' }),
    ).toBeDisabled();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { Transactions } from './Transactions';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: vi.fn().mockRejectedValue(new Error('trash failed')) },
}));

describe('Giao dịch - trạng thái lỗi', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('hiển thị lỗi và nút thử lại khi tải thùng rác thất bại', async () => {
    vi.mocked(useApp).mockReturnValue({
      transactions: [],
      setTransactions: vi.fn(),
      purposes: [],
      expenseTypes: [],
      paymentMethods: [],
      familyId: 'family-1',
      currentUserId: 'user-1',
      currentUserRole: 'owner',
    } as unknown as ReturnType<typeof useApp>);

    render(
      <FeedbackProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <Transactions />
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xem giao dịch đã xóa' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải giao dịch đã xóa.');
    });
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.queryByText('Chưa có giao dịch')).not.toBeInTheDocument();
  });
});

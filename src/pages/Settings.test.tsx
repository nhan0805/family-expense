import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { Settings } from './Settings';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false }));

describe('màn hình Cài đặt', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('gom bộ lọc mặc định và cấu hình giao dịch tự động trên cùng màn hình', async () => {
    vi.mocked(useApp).mockReturnValue({
      familyId: 'family-settings',
      currentUserId: 'user-settings',
      currentUserRole: 'owner',
      purposes: [{ id: 'purpose-investment', name: 'Đầu tư' }],
      expenseTypes: [{ id: 'expense-other', name: 'Khác' }],
      paymentMethods: [{ id: 'payment-bank', name: 'Chuyển khoản' }],
      transactions: [],
      online: true,
    } as unknown as ReturnType<typeof useApp>);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <FeedbackProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Settings />
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cài đặt' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Bộ lọc giao dịch mặc định' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Mặc định giao dịch tự động' })).toBeInTheDocument();
    });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('hiển thị hai nhóm cài đặt bằng tab', async () => {
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
      expect(screen.getByRole('tab', { name: 'Bộ lọc mặc định' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name: 'Bộ lọc mặc định' })).toBeInTheDocument();
    });

    const filtersTab = screen.getByRole('tab', { name: 'Bộ lọc mặc định' });
    const automaticTab = screen.getByRole('tab', { name: 'Giao dịch tự động' });
    fireEvent.keyDown(filtersTab, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(automaticTab).toHaveAttribute('aria-selected', 'true');
      expect(automaticTab).toHaveFocus();
      expect(screen.getByRole('heading', { name: 'Mặc định giao dịch tự động' })).toBeInTheDocument();
      expect(screen.getByRole('tabpanel', { name: 'Giao dịch tự động' })).toBeInTheDocument();
    });

    const catalogsTab = screen.getByRole('tab', { name: 'Mặc định danh mục' });
    fireEvent.click(catalogsTab);
    await waitFor(() => {
      expect(catalogsTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('heading', { name: 'Mặc định danh mục cho gia đình mới' })).toBeInTheDocument();
    });
  });
});

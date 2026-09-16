import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { MemoryRouter } from 'react-router-dom';
import { TransactionFilterSettings } from './TransactionFilterSettings';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

const appValue = {
  familyId: 'family-1',
  currentUserId: 'user-1',
  currentUserRole: 'owner',
  online: true,
  purposes: [{ id: 'p1', name: 'Sinh hoạt' }, { id: 'p2', name: 'Đầu tư' }],
  expenseTypes: [{ id: 'e1', name: 'Ăn uống' }],
  paymentMethods: [{ id: 'm1', name: 'Chuyển khoản' }],
} as unknown as ReturnType<typeof useApp>;

describe('màn hình bộ lọc giao dịch mặc định', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('hiển thị mặc định hệ thống và lưu bộ lọc cá nhân', async () => {
    vi.mocked(useApp).mockReturnValue(appValue);
    render(
      <FeedbackProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <TransactionFilterSettings />
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bộ lọc giao dịch mặc định' })).toBeInTheDocument());
    expect(screen.getByLabelText('Loại giao dịch')).toHaveValue('Chi tiêu');
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('Thực tế');
    expect(screen.getAllByText('Đầu tư').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Khoảng thời gian'), { target: { value: 'all-time' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bộ lọc mặc định' }));

    await waitFor(() => expect(screen.getByText('Đã lưu bộ lọc giao dịch mặc định.')).toBeInTheDocument());
    expect(screen.getByText('Đang có bộ lọc cá nhân')).toBeInTheDocument();
  });
});

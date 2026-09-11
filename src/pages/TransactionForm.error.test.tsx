import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { TransactionForm } from './TransactionForm';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke: vi.fn() } },
}));

it('không hiển thị loading vô hạn khi sửa giao dịch nhưng chưa có familyId', () => {
  vi.mocked(useApp).mockReturnValue({
    familyId: '',
    currentUserId: 'user-1',
    currentUserRole: 'owner',
    transactions: [],
    setTransactions: vi.fn(),
    purposes: [],
    expenseTypes: [],
    paymentMethods: [],
  } as unknown as ReturnType<typeof useApp>);

  render(
    <FeedbackProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/giao-dich/transaction-1']}>
          <Routes>
            <Route path="/giao-dich/:id" element={<TransactionForm />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </FeedbackProvider>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy gia đình đang hoạt động.');
  expect(screen.queryByLabelText('Đang tải thông tin giao dịch…')).not.toBeInTheDocument();
});

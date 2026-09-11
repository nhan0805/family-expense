import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../components/Feedback';
import { LanguageProvider } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { Budgets } from './Budgets';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: true }));

it('không hiển thị loading vô hạn khi ngân sách chưa có familyId', () => {
  vi.mocked(useApp).mockReturnValue({
    familyId: '',
    currentUserRole: 'member',
    purposes: [],
    transactions: [],
  } as unknown as ReturnType<typeof useApp>);

  render(
    <LanguageProvider>
      <FeedbackProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <Budgets />
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>
    </LanguageProvider>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy gia đình đang hoạt động.');
  expect(screen.queryByLabelText('Đang tải ngân sách…')).not.toBeInTheDocument();
});

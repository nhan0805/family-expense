import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from './Feedback';
import { useApp } from '../context/AppContext';
import { LanguageProvider } from '../context/LanguageContext';
import { upsertLocalBudget } from '../lib/budget';
import type { Transaction } from '../lib/domain';
import { BudgetNotifications } from './BudgetNotifications';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false }));

const mockedUseApp = vi.mocked(useApp);

function monthKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

const transaction: Transaction = {
  id: 't1',
  transactionDate: `${monthKey()}-10`,
  amount: 800_000,
  transactionType: 'Chi tiêu',
  status: 'Thực tế',
  description: 'Mua thực phẩm',
  purposeId: 'p1',
  expenseTypeId: 'e1',
  paymentMethodId: 'm1',
  source: 'manual',
  aiGenerated: false,
};

function renderNotifications(language: 'vi' | 'en' = 'vi') {
  window.localStorage.setItem('family-expense-language', language);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LanguageProvider>
      <FeedbackProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <BudgetNotifications />
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>
    </LanguageProvider>,
  );
}

describe('BudgetNotifications', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedUseApp.mockReturnValue({
      familyId: 'family-1',
      purposes: [{ id: 'p1', name: 'Sinh hoạt', nameEn: 'Family living' }],
      transactions: [transaction],
    } as unknown as ReturnType<typeof useApp>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hiển thị toast, badge chưa đọc và đánh dấu đã đọc từ chuông', async () => {
    const [year = '2000', month = '1'] = monthKey().split('-');
    upsertLocalBudget({ year: Number(year), month: Number(month), purposeId: 'p1', amount: 1_000_000, warningThreshold: 0.8 });
    renderNotifications();

    await waitFor(() => expect(screen.getByText(/Sinh hoạt đã dùng 80% ngân sách/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Thông báo ngân sách' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thông báo ngân sách' }));
    expect(screen.getByRole('dialog', { name: 'Thông báo ngân sách' })).toBeInTheDocument();
    expect(screen.getByText('Sắp vượt ngân sách: Sinh hoạt')).toBeInTheDocument();
    expect(screen.getByLabelText('1 chưa đọc')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Sắp vượt ngân sách: Sinh hoạt/ }));
    await waitFor(() => expect(screen.queryByLabelText('1 chưa đọc')).not.toBeInTheDocument());
  });

  it('dịch chuông và nội dung cảnh báo sang tiếng Anh', async () => {
    const [year = '2000', month = '1'] = monthKey().split('-');
    upsertLocalBudget({ year: Number(year), month: Number(month), purposeId: 'p1', amount: 1_000_000, warningThreshold: 0.8 });
    renderNotifications('en');

    await waitFor(() => expect(screen.getByText(/Family living has reached 80%/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Budget notifications' }));
    expect(screen.getByText('Near limit: Family living')).toBeInTheDocument();
  });
});

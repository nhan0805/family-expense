import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../components/Feedback';
import { LanguageProvider } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import type { Transaction } from '../lib/domain';
import { Budgets } from './Budgets';

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

const transaction = (month: string): Transaction => ({
  id: 'grocery',
  transactionDate: `${month}-01`,
  amount: 800_000,
  transactionType: 'Chi tiêu',
  status: 'Thực tế',
  description: 'Mua thực phẩm',
  purposeId: 'p1',
  expenseTypeId: 'e1',
  paymentMethodId: 'm1',
  source: 'manual',
  aiGenerated: false,
});

function appState(role: 'owner' | 'member') {
  return {
    familyId: '',
    currentUserRole: role,
    purposes: [{ id: 'p1', name: 'Sinh hoạt', nameEn: 'Family living' }],
    transactions: [transaction(monthKey())],
    online: true,
  } as unknown as ReturnType<typeof useApp>;
}

function renderBudgets(language: 'vi' | 'en' = 'vi') {
  window.localStorage.setItem('family-expense-language', language);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LanguageProvider>
      <FeedbackProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <Budgets />
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>
    </LanguageProvider>,
  );
}

describe('Quản lý ngân sách V1', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedUseApp.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('cho owner đặt ngân sách theo mục đích và dẫn tới giao dịch đã lọc', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    renderBudgets();

    expect(screen.getByRole('heading', { name: 'Ngân sách', level: 2 })).toHaveClass('page-title');
    fireEvent.click(screen.getByRole('button', { name: 'Đặt ngân sách' }));
    fireEvent.change(screen.getByLabelText('Số tiền ngân sách Sinh hoạt'), { target: { value: '1.000.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ngân sách' }));

    await waitFor(() => expect(screen.getAllByText(/1\.000\.000 ₫/).length).toBeGreaterThan(0));
    expect(screen.getByRole('link', { name: 'Giao dịch' })).toHaveAttribute(
      'href',
      expect.stringContaining('purposeId=p1'),
    );
    expect(screen.getByText('Sắp vượt')).toBeInTheDocument();
    expect(screen.getByText('Chỉ tính chi tiêu thực tế')).toBeInTheDocument();
  });

  it('giữ quyền chỉ đọc cho member và hỗ trợ giao diện tiếng Anh', () => {
    mockedUseApp.mockReturnValue(appState('member'));
    renderBudgets('en');

    expect(screen.getByRole('heading', { name: 'Budgets', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Actual expenses only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set budget' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy previous month' })).toBeDisabled();
  });
});

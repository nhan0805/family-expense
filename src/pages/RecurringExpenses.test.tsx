import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { LanguageProvider } from '../context/LanguageContext';
import { deleteLocalRecurringExpense, todayInVietnam, upsertLocalRecurringExpense } from '../lib/recurringExpense';
import { RecurringExpenses } from './RecurringExpenses';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false }));

const mockedUseApp = vi.mocked(useApp);

function appState(role: 'owner' | 'member') {
  return {
    familyId: 'local-family',
    currentUserId: 'local-user',
    currentUserRole: role,
    purposes: [{ id: 'p1', name: 'Sinh hoạt' }],
    expenseTypes: [{ id: 'e1', name: 'Điện' }],
    paymentMethods: [{ id: 'm1', name: 'Chuyển khoản' }],
    transactions: [],
    setTransactions: vi.fn(),
    online: true,
  } as unknown as ReturnType<typeof useApp>;
}

function renderPage() {
  return render(
    <LanguageProvider>
      <FeedbackProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <RecurringExpenses />
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>
    </LanguageProvider>,
  );
}

describe('Chi phí định kỳ', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedUseApp.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('cho owner tạo mẫu và tự sinh giao dịch dự kiến đến hạn trong demo', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm khoản định kỳ' }));
    fireEvent.change(screen.getByLabelText('Tên mẫu'), { target: { value: 'Tiền điện' } });
    fireEvent.change(screen.getByLabelText('Nội dung giao dịch'), { target: { value: 'Tiền điện' } });
    fireEvent.change(screen.getByLabelText('Số tiền (VND)'), { target: { value: '300000' } });
    fireEvent.change(screen.getByLabelText('Mục đích'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'e1' } });
    fireEvent.change(screen.getByLabelText('Phương thức thanh toán'), { target: { value: 'm1' } });
    fireEvent.change(screen.getByLabelText('Ngày chạy tiếp theo'), { target: { value: todayInVietnam() } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }));

    expect(await screen.findByText('Tiền điện')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo giao dịch đến hạn' }));
    expect(await screen.findByText('Đã tạo 1 giao dịch dự kiến.')).toBeInTheDocument();
  });

  it('giữ màn hình ở chế độ chỉ xem cho member', async () => {
    mockedUseApp.mockReturnValue(appState('member'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Chi phí định kỳ', level: 2 })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Thêm khoản định kỳ' })).not.toBeInTheDocument();
    expect(screen.getByText('Chủ gia đình chưa thiết lập khoản chi định kỳ nào.')).toBeInTheDocument();
  });

  it('không hiển thị nút xóa cho member dù đã có mẫu', async () => {
    mockedUseApp.mockReturnValue(appState('member'));
    upsertLocalRecurringExpense('local-family', {
      name: 'Tiền điện',
      template: {
        transactionType: 'Chi tiêu',
        description: 'Tiền điện',
        amount: 300000,
        purposeId: 'p1',
        expenseTypeId: 'e1',
        paymentMethodId: 'm1',
        note: null,
      },
      frequency: 'monthly',
      nextRunDate: '2099-09-05',
      endDate: null,
    });
    renderPage();

    expect(await screen.findByText('Tiền điện')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
  });

  it('cho owner xóa mềm mẫu và ẩn khỏi danh sách', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm khoản định kỳ' }));
    fireEvent.change(screen.getByLabelText('Tên mẫu'), { target: { value: 'Tiền điện' } });
    fireEvent.change(screen.getByLabelText('Nội dung giao dịch'), { target: { value: 'Tiền điện' } });
    fireEvent.change(screen.getByLabelText('Số tiền (VND)'), { target: { value: '300000' } });
    fireEvent.change(screen.getByLabelText('Mục đích'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'e1' } });
    fireEvent.change(screen.getByLabelText('Phương thức thanh toán'), { target: { value: 'm1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }));

    expect(await screen.findByText('Tiền điện')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa mẫu' }));

    await waitFor(() => expect(screen.getByText('Mẫu định kỳ đã xóa')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Khôi phục' })).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem('family-expense:recurring-expenses:local-family') || '[]') as Array<{ deletedAt?: string; active?: boolean }>;
    expect(stored[0]?.deletedAt).toBeTruthy();
    expect(stored[0]?.active).toBe(false);
  });

  it('cho owner khôi phục mẫu đã xóa mềm', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    const item = upsertLocalRecurringExpense('local-family', {
      name: 'Tiền điện',
      template: { transactionType: 'Chi tiêu', description: 'Tiền điện', amount: 300000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', note: null },
      frequency: 'monthly',
      nextRunDate: '2099-09-05',
      endDate: null,
    });
    deleteLocalRecurringExpense('local-family', item.id);
    renderPage();

    expect(await screen.findByText('Mẫu định kỳ đã xóa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục mẫu' }));

    await waitFor(() => expect(screen.queryByText('Mẫu định kỳ đã xóa')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('family-expense:recurring-expenses:local-family') || '[]')[0]?.deletedAt).toBeNull();
  });

  it('cho owner xóa cứng mẫu đã xóa mềm', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    const item = upsertLocalRecurringExpense('local-family', {
      name: 'Tiền điện',
      template: { transactionType: 'Chi tiêu', description: 'Tiền điện', amount: 300000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', note: null },
      frequency: 'monthly',
      nextRunDate: '2099-09-05',
      endDate: null,
    });
    deleteLocalRecurringExpense('local-family', item.id);
    renderPage();

    expect(await screen.findByText('Mẫu định kỳ đã xóa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa vĩnh viễn' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa vĩnh viễn mẫu' }));

    await waitFor(() => expect(screen.queryByText('Mẫu định kỳ đã xóa')).not.toBeInTheDocument());
    expect(screen.queryByText('Tiền điện')).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('family-expense:recurring-expenses:local-family') || '[]')).toHaveLength(0);
  });
});

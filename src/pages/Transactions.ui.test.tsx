import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { Transactions } from './Transactions';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

describe('Giao dịch mobile', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('hiển thị bộ lọc trực tiếp và menu ba chấm trên card', () => {
    const setTransactions = vi.fn();
    vi.mocked(useApp).mockReturnValue({
      transactions: [{ id: 't1', transactionDate: '2026-09-01', transactionType: 'Chi tiêu', status: 'Thực tế', description: 'Đi chợ', amount: 250000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', source: 'manual', aiGenerated: false, createdBy: 'u1' }],
      setTransactions, purposes: [{ id: 'p1', name: 'Sinh hoạt' }, { id: 'p2', name: 'Du lịch' }], expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }], paymentMethods: [{ id: 'm1', name: 'Tiền mặt' }], familyId: 'f1', currentUserId: 'u1', currentUserRole: 'owner',
    } as unknown as ReturnType<typeof useApp>);
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/giao-dich?month=09&year=2026']}><Transactions/></MemoryRouter></QueryClientProvider></FeedbackProvider>);
    expect(screen.getByRole('region', { name: 'Tìm kiếm và bộ lọc giao dịch' })).not.toHaveClass('sticky');
    const filterToggle = screen.getByText(/Bộ lọc chi tiết/);
    const filterDetails = filterToggle.closest('details');
    expect(filterDetails).not.toHaveAttribute('open');
    fireEvent.click(filterToggle);
    expect(filterDetails).toHaveAttribute('open');
    expect(screen.getByLabelText('Loại giao dịch')).toBeInTheDocument();
    expect(screen.getByLabelText('Trạng thái')).toBeInTheDocument();
    const minAmountInput = screen.getByLabelText('Từ số tiền');
    const maxAmountInput = screen.getByLabelText('Đến số tiền');
    expect(minAmountInput).toHaveAttribute('type', 'text');
    expect(minAmountInput).toHaveAttribute('inputmode', 'numeric');
    expect(minAmountInput).toHaveClass('!text-base');
    expect(minAmountInput).not.toHaveAttribute('placeholder');
    expect(maxAmountInput).not.toHaveAttribute('placeholder');
    fireEvent.change(minAmountInput, { target: { value: '1234567' } });
    expect(minAmountInput).toHaveValue('1.234.567');
    fireEvent.change(minAmountInput, { target: { value: '' } });
    const aiSearchButton = screen.getByRole('button', { name: 'Tìm kiếm bằng AI' });
    expect(aiSearchButton).toBeDisabled();
    expect(aiSearchButton.className).toContain('bg-gradient-to-r');
    expect(aiSearchButton.className).toContain('active:scale-[.98]');
    const transactionCard = screen.getByRole('article', { name: 'Giao dịch Đi chợ' });
    expect(transactionCard).toHaveClass('rounded-2xl', 'shadow-sm');
    expect(transactionCard).not.toHaveClass('border-t');
    fireEvent.click(screen.getByRole('button', { name: 'Thao tác với Đi chợ' }));
    expect(screen.getByText('Sao chép')).toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes('250.000')).length).toBeGreaterThan(0);
  });

  it('chuyển giọng nói thành từ khóa tìm kiếm', async () => {
    class SpeechRecognitionMock {
      static latest: SpeechRecognitionMock | null = null;
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() { SpeechRecognitionMock.latest = this; }
    }
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: SpeechRecognitionMock });
    vi.mocked(useApp).mockReturnValue({
      transactions: [], setTransactions: vi.fn(), purposes: [], expenseTypes: [], paymentMethods: [], familyId: 'f1', currentUserId: 'u1', currentUserRole: 'owner',
    } as unknown as ReturnType<typeof useApp>);
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter><Transactions/></MemoryRouter></QueryClientProvider></FeedbackProvider>);
    const input = screen.getByPlaceholderText('Tìm nội dung hoặc ghi chú…');
    fireEvent.click(screen.getByRole('button', { name: 'Nhập tìm kiếm bằng giọng nói' }));
    expect(screen.getByRole('button', { name: 'Dừng nhập bằng giọng nói' })).toHaveAttribute('aria-pressed', 'true');
    SpeechRecognitionMock.latest?.onresult?.({ results: [{ 0: { transcript: 'chi tiêu tháng 8' }, isFinal: true }] });
    await waitFor(() => expect(input).toHaveValue('chi tiêu tháng 8'));
    fireEvent.click(screen.getByRole('button', { name: 'Dừng nhập bằng giọng nói' }));
    expect(SpeechRecognitionMock.latest?.stop).toHaveBeenCalled();
    delete (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  it('nhận đúng khoảng ngày khi mở từ KPI nhiều tháng', () => {
    vi.mocked(useApp).mockReturnValue({
      transactions: [
        { id: 't1', transactionDate: '2025-09-15', transactionType: 'Chi tiêu', status: 'Thực tế', description: 'Trong đầu kỳ', amount: 100000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', source: 'manual', aiGenerated: false, createdBy: 'u1' },
        { id: 't2', transactionDate: '2026-02-28', transactionType: 'Chi tiêu', status: 'Thực tế', description: 'Trong cuối kỳ', amount: 200000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', source: 'manual', aiGenerated: false, createdBy: 'u1' },
        { id: 't3', transactionDate: '2026-03-01', transactionType: 'Chi tiêu', status: 'Thực tế', description: 'Ngoài kỳ', amount: 300000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', source: 'manual', aiGenerated: false, createdBy: 'u1' },
      ],
      setTransactions: vi.fn(),
      purposes: [{ id: 'p1', name: 'Sinh hoạt' }],
      expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }],
      paymentMethods: [{ id: 'm1', name: 'Tiền mặt' }],
      familyId: 'f1',
      currentUserId: 'u1',
      currentUserRole: 'owner',
    } as unknown as ReturnType<typeof useApp>);
    render(
      <FeedbackProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/giao-dich?transactionType=Chi%20ti%C3%AAu&dateFrom=2025-09-01&dateTo=2026-02-28']}>
            <Transactions />
          </MemoryRouter>
        </QueryClientProvider>
      </FeedbackProvider>,
    );

    expect(screen.getByRole('article', { name: 'Giao dịch Trong đầu kỳ' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Giao dịch Trong cuối kỳ' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Giao dịch Ngoài kỳ' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Từ ngày')).toHaveValue('2025-09-01');
    expect(screen.getByLabelText('Đến ngày')).toHaveValue('2026-02-28');
  });

  it('hiển thị và xác nhận giao dịch dự kiến đã tới hạn', async () => {
    const setTransactions = vi.fn();
    vi.mocked(useApp).mockReturnValue({
      transactions: [{ id: 'planned-1', transactionDate: '2026-09-01', transactionType: 'Chi tiêu', status: 'Dự kiến', description: 'Tiền điện', amount: 300000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', source: 'manual', aiGenerated: false, createdBy: 'u1' }],
      setTransactions, purposes: [{ id: 'p1', name: 'Sinh hoạt' }], expenseTypes: [{ id: 'e1', name: 'Hóa đơn' }], paymentMethods: [{ id: 'm1', name: 'Chuyển khoản' }], familyId: 'f1', currentUserId: 'u1', currentUserRole: 'owner',
    } as unknown as ReturnType<typeof useApp>);
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/giao-dich?month=09&year=2026']}><Transactions/></MemoryRouter></QueryClientProvider></FeedbackProvider>);
    expect(screen.getByRole('heading', { name: 'Giao dịch dự kiến tới hạn' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Xác nhận' })[0]!);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(setTransactions).toHaveBeenCalled());
    expect(screen.getByText('Đã xác nhận 1 giao dịch.')).toBeInTheDocument();
  });

  it('chọn nhiều và chỉ sửa bốn trường bắt buộc', async () => {
    const setTransactions = vi.fn();
    vi.mocked(useApp).mockReturnValue({
      transactions: [{ id: 't1', transactionDate: '2026-09-01', transactionType: 'Chi tiêu', status: 'Thực tế', description: 'Đi chợ', amount: 250000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', source: 'manual', aiGenerated: false, createdBy: 'u1' }],
      setTransactions, purposes: [{ id: 'p1', name: 'Sinh hoạt' }, { id: 'p2', name: 'Du lịch' }], expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }], paymentMethods: [{ id: 'm1', name: 'Tiền mặt' }], familyId: 'f1', currentUserId: 'u1', currentUserRole: 'owner',
    } as unknown as ReturnType<typeof useApp>);
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/giao-dich?month=09&year=2026']}><Transactions/></MemoryRouter></QueryClientProvider></FeedbackProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Chọn nhiều giao dịch' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn giao dịch Đi chợ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa các giao dịch đã chọn' }));
    const dialog = screen.getByRole('dialog', { name: 'Sửa 1 giao dịch' });
    expect(within(dialog).getByLabelText('Mục đích')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Danh mục')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Phương thức thanh toán')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Trạng thái')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Sự kiện/Kế hoạch')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Người hưởng lợi')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Tài khoản/Thẻ')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Mục đích'), { target: { value: 'p2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận cập nhật' }));
    await waitFor(() => expect(setTransactions).toHaveBeenCalled());
    expect(screen.getByText('Đã cập nhật 1 giao dịch.')).toBeInTheDocument();
  });

  it('hiển thị nút xóa hàng loạt khi đã chọn giao dịch có quyền xóa', () => {
    vi.mocked(useApp).mockReturnValue({
      transactions: [{ id: 't1', transactionDate: '2026-09-01', transactionType: 'Chi tiêu', status: 'Thực tế', description: 'Đi chợ', amount: 250000, purposeId: 'p1', expenseTypeId: 'e1', paymentMethodId: 'm1', source: 'manual', aiGenerated: false, createdBy: 'u1' }],
      setTransactions: vi.fn(), purposes: [{ id: 'p1', name: 'Sinh hoạt' }], expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }], paymentMethods: [{ id: 'm1', name: 'Tiền mặt' }], familyId: 'f1', currentUserId: 'u1', currentUserRole: 'owner',
    } as unknown as ReturnType<typeof useApp>);
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/giao-dich?month=09&year=2026']}><Transactions/></MemoryRouter></QueryClientProvider></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Chọn nhiều giao dịch' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn giao dịch Đi chợ' }));
    expect(screen.getByRole('button', { name: 'Xóa các giao dịch đã chọn' })).toBeEnabled();
  });
});

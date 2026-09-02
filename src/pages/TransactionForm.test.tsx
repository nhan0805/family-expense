import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { clearTransactionDraft, readTransactionDraft, saveTransactionDraft } from '../lib/transactionDraft';
import { TransactionForm } from './TransactionForm';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
const invokeMock = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke: invokeMock } },
}));

const appValue = {
  transactions: [], setTransactions: vi.fn(), familyId: 'f1', currentUserId: 'u1', currentUserRole: 'owner',
  purposes: [{ id: 'p1', name: 'Sinh hoạt' }], expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }],
  paymentMethods: [{ id: 'm1', name: 'Chuyển khoản' }],
} as unknown as ReturnType<typeof useApp>;

describe('Form giao dịch hợp nhất', () => {
  afterEach(() => {
    cleanup();
    clearTransactionDraft('f1');
    vi.clearAllMocks();
  });

  it('dùng chung ô nội dung cho nhập tay và gợi ý AI', () => {
    vi.mocked(useApp).mockReturnValue(appValue);
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter><TransactionForm/></MemoryRouter></QueryClientProvider></FeedbackProvider>);

    expect(screen.queryByText('Nhập thông thường')).not.toBeInTheDocument();
    expect(screen.queryByText('Nhập bằng AI')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thêm giao dịch' })).toHaveClass('page-title');
    expect(screen.getByRole('form')).toHaveClass('form-panel');
    expect(screen.getByLabelText(/Nội dung/)).not.toHaveAttribute('placeholder');
    expect(screen.getByLabelText(/Nội dung/)).toHaveClass('field-with-trailing-action');
    expect(screen.getByLabelText(/Số tiền/)).not.toHaveAttribute('placeholder');
    const aiButton = screen.getByRole('button', { name: 'Phân tích nội dung bằng AI' });
    expect(aiButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Nội dung/), { target: { value: 'Hôm nay mua sữa 450 nghìn' } });
    expect(aiButton).toBeEnabled();
  });

  it('thông báo, tóm tắt và đánh dấu đúng các trường AI đã điền', async () => {
    vi.mocked(useApp).mockReturnValue(appValue);
    invokeMock.mockResolvedValue({
      data: { suggestion: {
        date: '2026-08-27', description: 'Mua sữa cho Haku', amount: 450000,
        transactionType: 'Chi tiêu', status: 'Thực tế', purposeId: 'p1', purposeName: 'Sinh hoạt',
        expenseTypeId: 'e1', expenseTypeName: 'Thực phẩm', paymentMethodId: 'm1',
        paymentMethodName: 'Chuyển khoản', confidence: 0.95, warnings: [],
      } },
      error: null,
    });
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter><TransactionForm/></MemoryRouter></QueryClientProvider></FeedbackProvider>);

    fireEvent.change(screen.getByLabelText(/Nội dung/), { target: { value: 'Mua sữa 450 nghìn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Phân tích nội dung bằng AI' }));

    expect(await screen.findByText('AI đã đề xuất 8 trường')).toBeInTheDocument();
    expect(screen.getByText('AI đã đề xuất 8 trường. Hãy kiểm tra trước khi lưu.')).toBeInTheDocument();
    expect(screen.getByText(/Ngày, Nội dung, Loại giao dịch, Trạng thái, Số tiền/)).toBeInTheDocument();
    expect(screen.getAllByText('AI đề xuất')).toHaveLength(7);
    const paymentField = screen.getByLabelText(/Phương thức thanh toán/).closest('label');
    expect(paymentField).not.toBeNull();
    expect(paymentField?.querySelector('.label')).toHaveClass('flex', 'items-center');
    expect(within(paymentField as HTMLElement).getByText('AI đề xuất')).toHaveClass('shrink-0', 'whitespace-nowrap');
    expect(screen.getByLabelText(/Nội dung/)).toHaveValue('Mua sữa cho Haku');
    expect(screen.getByLabelText(/Số tiền/)).toHaveValue('450.000');
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn tóm tắt và đánh dấu AI' }));
    await waitFor(() => expect(screen.queryByText('AI đã đề xuất 8 trường')).not.toBeInTheDocument());
    expect(screen.queryAllByText('AI đề xuất')).toHaveLength(0);
  });

  it('chuyển giọng nói tiếng Việt thành chữ nhưng không tự chạy AI', async () => {
    vi.mocked(useApp).mockReturnValue(appValue);
    class SpeechRecognitionMock {
      static latest: SpeechRecognitionMock | null = null;
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null = null;
      onerror = null;
      onend = null;
      constructor() { SpeechRecognitionMock.latest = this; }
      start = vi.fn();
      stop = vi.fn();
    }
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: SpeechRecognitionMock });
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter><TransactionForm/></MemoryRouter></QueryClientProvider></FeedbackProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Nhập nội dung bằng giọng nói' }));
    expect(screen.getByRole('button', { name: 'Dừng nhập bằng giọng nói' })).toHaveAttribute('aria-pressed', 'true');
    const speechResult = { 0: { transcript: 'mua sữa bốn trăm năm mươi nghìn' }, isFinal: true };
    SpeechRecognitionMock.latest?.onresult?.({ results: [speechResult] });

    await waitFor(() => expect(screen.getByLabelText(/Nội dung/)).toHaveValue('mua sữa bốn trăm năm mươi nghìn'));
    expect(screen.getByText('Đã chuyển giọng nói thành nội dung. Hãy kiểm tra trước khi dùng AI.')).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
    delete (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  it('xóa bản nháp khi hủy thêm giao dịch', async () => {
    vi.mocked(useApp).mockReturnValue(appValue);
    saveTransactionDraft('f1', { description: 'Bản nháp cần bỏ', amount: 450000 });
    render(<FeedbackProvider><QueryClientProvider client={new QueryClient()}><MemoryRouter><TransactionForm/></MemoryRouter></QueryClientProvider></FeedbackProvider>);

    await waitFor(() => expect(screen.getByText('Đã khôi phục bản nháp trên thiết bị. Hãy kiểm tra trước khi lưu.')).toBeInTheDocument());
    expect(readTransactionDraft('f1')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(readTransactionDraft('f1')).toBeNull();
  });
});

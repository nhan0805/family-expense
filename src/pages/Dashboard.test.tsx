import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useApp } from '../context/AppContext';
import type { Transaction } from '../lib/domain';
import { Dashboard } from './Dashboard';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false }));

const transaction = (
  id: string,
  transactionDate: string,
  amount: number,
  status: Transaction['status'] = 'Thực tế',
): Transaction => ({
  id,
  transactionDate,
  amount,
  transactionType: 'Chi tiêu',
  status,
  description: id,
  purposeId: 'p1',
  expenseTypeId: 'e1',
  source: 'manual',
  aiGenerated: false,
});

const confirmPlannedTransaction = vi.fn().mockResolvedValue(null);
const renderDashboard = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Dashboard', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lọc KPI và giao dịch theo tháng được chọn', () => {
    vi.mocked(useApp).mockReturnValue({
      transactions: [
        transaction('Chi tháng 1', '2026-01-10', 100_000),
        transaction('Chi tháng 2', '2026-02-10', 250_000),
      ],
      purposes: [{ id: 'p1', name: 'Sinh hoạt' }],
      expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }],
      confirmPlannedTransaction,
    } as unknown as ReturnType<typeof useApp>);
    renderDashboard();

    fireEvent.change(screen.getByLabelText('Tháng'), {
      target: { value: '02' },
    });
    fireEvent.change(screen.getByLabelText('Năm'), {
      target: { value: '2026' },
    });

    expect(screen.getByText('Tháng 02/2026')).toBeInTheDocument();
    expect(screen.getByText('Chi tiêu theo loại chi phí')).toBeInTheDocument();
    expect(screen.getByText('Tổng chi').parentElement).toHaveTextContent(
      '250.000',
    );
    expect(screen.getByText('Giá trị ròng').parentElement?.parentElement?.firstElementChild).toHaveClass('bg-rose-100');
    expect(screen.getByText('Chi tháng 2')).toBeInTheDocument();
    expect(screen.queryByText('Chi tháng 1')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute(
      'href',
      '/giao-dich?month=02&year=2026',
    );
  });

  it('hiển thị trạng thái trống khi tháng không có giao dịch', () => {
    vi.mocked(useApp).mockReturnValue({
      transactions: [],
      purposes: [],
      expenseTypes: [],
      confirmPlannedTransaction,
    } as unknown as ReturnType<typeof useApp>);
    renderDashboard();

    expect(screen.getByText('Tổng quan tài chính')).toBeInTheDocument();
    expect(
      screen.getByText('Chưa có giao dịch trong tháng này'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Chưa có dữ liệu biểu đồ'),
    ).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Thêm giao dịch' })).toHaveAttribute('href', '/giao-dich/moi');
  });

  it('cho phép xác nhận giao dịch dự kiến đã đến hạn', async () => {
    confirmPlannedTransaction.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(useApp).mockReturnValue({
      transactions: [
        transaction('Tiền điện dự kiến', '2020-01-10', 500_000, 'Dự kiến'),
      ],
      purposes: [{ id: 'p1', name: 'Sinh hoạt' }],
      expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }],
      confirmPlannedTransaction,
    } as unknown as ReturnType<typeof useApp>);
    renderDashboard();

    expect(screen.getByText('Giao dịch dự kiến đến hạn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thực tế' }));
    await waitFor(() =>
      expect(confirmPlannedTransaction).toHaveBeenCalledWith(
        'Tiền điện dự kiến',
      ),
    );
  });
});

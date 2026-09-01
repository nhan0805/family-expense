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
import { Dashboard, formatPieLabel, summarizePieData } from './Dashboard';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false }));

const transaction = (
  id: string,
  transactionDate: string,
  amount: number,
  status: Transaction['status'] = 'Thực tế',
  transactionType: Transaction['transactionType'] = 'Chi tiêu',
): Transaction => ({
  id,
  transactionDate,
  amount,
  transactionType,
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

    expect(screen.getByRole('heading', { name: 'Tổng quan tài chính' })).toHaveClass('page-title');
    expect(screen.getByRole('region', { name: 'Bộ lọc kỳ Dashboard' })).toHaveClass(
      'card',
      'dashboard-controls',
    );
    fireEvent.change(screen.getByLabelText('Tháng'), {
      target: { value: '02' },
    });
    fireEvent.change(screen.getByLabelText('Năm'), {
      target: { value: '2026' },
    });

    expect(screen.getByText('Tháng 02/2026')).toBeInTheDocument();
    expect(screen.getByText('Chi tiêu theo danh mục')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tháng trước' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tháng này' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng chi' })).toHaveTextContent('250K');
    const kpiLinks = screen.getAllByRole('link', { name: /Mở giao dịch theo Tổng (thu|chi)/ });
    expect(kpiLinks[0]).toHaveAccessibleName('Mở giao dịch theo Tổng thu');
    expect(kpiLinks[1]).toHaveAccessibleName('Mở giao dịch theo Tổng chi');
    expect(screen.queryByText('Trung bình / tháng')).not.toBeInTheDocument();
    expect(screen.queryByText('Tháng cao nhất')).not.toBeInTheDocument();
    expect(screen.queryByText('Tháng thấp nhất')).not.toBeInTheDocument();
    expect(screen.queryByText(/có mức chi cao nhất trong kỳ xem/)).not.toBeInTheDocument();
    expect(screen.queryByText(/có mức chi thấp nhất trong kỳ xem/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng thu' })).toHaveAttribute(
      'href',
      '/giao-dich?transactionType=Thu nhập&month=02&year=2026',
    );
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng chi' })).toHaveAttribute(
      'href',
      '/giao-dich?transactionType=Chi tiêu&month=02&year=2026',
    );
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Giá trị ròng' })).toHaveAttribute(
      'href',
      '/giao-dich?month=02&year=2026',
    );
    const netKpi = screen.getByRole('link', { name: 'Mở giao dịch theo Giá trị ròng' });
    expect(netKpi).toHaveClass('block', 'h-full', 'kpi-card');
    expect(netKpi.querySelector('span')).toHaveClass('bg-rose-100');
    expect(screen.queryByText('Giao dịch thực tế trong tháng')).not.toBeInTheDocument();
    expect(screen.queryByText('Chi tháng 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Chi tháng 1')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Tóm tắt bằng AI' })).toBeDisabled();
    expect(screen.queryByText('Giao dịch thực tế trong tháng')).not.toBeInTheDocument();
    expect(
      screen.getAllByText('Chưa có dữ liệu biểu đồ'),
    ).toHaveLength(4);
  });

  it('ẩn label pie của lát nhỏ để tránh chồng lấp', () => {
    const expenseTypes = Array.from({ length: 9 }, (_, index) => ({
      id: `e${index + 1}`,
      name: `Danh mục ${index + 1}`,
    }));
    vi.mocked(useApp).mockReturnValue({
      transactions: expenseTypes.map((item, index) => ({
        ...transaction(`Khoản ${index + 1}`, `2026-08-${String(index + 1).padStart(2, '0')}`, index === 0 ? 1_000_000 : 1_000 * (10 - index)),
        expenseTypeId: item.id,
      })),
      purposes: [{ id: 'p1', name: 'Sinh hoạt' }],
      expenseTypes,
      confirmPlannedTransaction,
    } as unknown as ReturnType<typeof useApp>);
    renderDashboard();

    expect(screen.getByText('Chi tiêu theo danh mục')).toBeInTheDocument();
    expect(formatPieLabel({ percent: 0.95, value: 1_000_000 })).toBe('1M');
    expect(formatPieLabel({ percent: 0.01, value: 10_000 })).toBeNull();
    const summarized = summarizePieData(expenseTypes.map((item, index) => ({
      ...item,
      value: index === 0 ? 1_000_000 : 1_000 * (10 - index),
      fill: '#155e46',
    })));
    expect(summarized).toHaveLength(6);
    expect(summarized.at(-1)).toMatchObject({ id: 'other', name: 'Khác', value: 14_000 });
    expect(summarized.at(-1)?.hiddenItems).toHaveLength(4);
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

  it('tính đúng Tạm ứng, Hoàn tiền và các preset kỳ xem', () => {
    vi.mocked(useApp).mockReturnValue({
      transactions: [
        transaction('Chi tháng 1', '2026-01-10', 100_000),
        transaction('Tạm ứng tháng 2', '2026-02-10', 200_000, 'Thực tế', 'Tạm ứng'),
        transaction('Hoàn tiền tháng 2', '2026-02-12', 50_000, 'Thực tế', 'Hoàn tiền'),
        transaction('Thu tháng 2', '2026-02-20', 500_000, 'Thực tế', 'Thu nhập'),
      ],
      purposes: [{ id: 'p1', name: 'Sinh hoạt' }],
      expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }],
      confirmPlannedTransaction,
    } as unknown as ReturnType<typeof useApp>);
    renderDashboard();

    const periodGroup = screen.getByRole('group', { name: 'Kỳ xem' });
    expect(periodGroup).toHaveClass('flex-nowrap', 'overflow-x-auto');
    expect(screen.getByRole('button', { name: 'Tùy chỉnh' })).toHaveClass(
      'shrink-0',
      'whitespace-nowrap',
    );
    fireEvent.change(screen.getByLabelText('Tháng'), { target: { value: '02' } });
    fireEvent.click(screen.getByRole('button', { name: '6 tháng' }));

    expect(screen.getByText('6 tháng đến T02/2026')).toBeInTheDocument();
    expect(screen.getByText('Trung bình / tháng')).toBeInTheDocument();
    expect(screen.getByText('Tháng cao nhất')).toBeInTheDocument();
    expect(screen.getByText('Tháng thấp nhất')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Giá trị ròng' })).toHaveClass(
      'block',
      'h-full',
    );
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng chi' })).toHaveTextContent('300K');
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng thu' })).toHaveTextContent('550K');
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng chi' })).toHaveAttribute(
      'href',
      expect.stringContaining('dateFrom=2025-09-01'),
    );
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng chi' })).toHaveAttribute(
      'href',
      expect.stringContaining('dateTo=2026-02-28'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng chi' })).toHaveTextContent('200K');
    expect(screen.getByText('Chi tiêu theo danh mục')).toBeInTheDocument();
  });

  it('lọc chính xác ngày trong kỳ tùy chỉnh', () => {
    vi.mocked(useApp).mockReturnValue({
      transactions: [
        transaction('Ngoài kỳ', '2026-02-01', 100_000),
        transaction('Trong kỳ', '2026-02-15', 200_000),
        transaction('Ngoài kỳ sau', '2026-03-01', 400_000),
      ],
      purposes: [{ id: 'p1', name: 'Sinh hoạt' }],
      expenseTypes: [{ id: 'e1', name: 'Thực phẩm' }],
      confirmPlannedTransaction,
    } as unknown as ReturnType<typeof useApp>);
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh' }));
    fireEvent.input(screen.getByLabelText('Từ ngày'), { target: { value: '2026-02-10' } });
    fireEvent.input(screen.getByLabelText('Đến ngày'), { target: { value: '2026-02-28' } });

    expect(screen.getByRole('link', { name: 'Mở giao dịch theo Tổng chi' })).toHaveTextContent('200K');
    expect(screen.getByText('10/02/2026 – 28/02/2026')).toBeInTheDocument();
  });
});

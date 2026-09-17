import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { automaticTransactionDefaultsStorageKey } from '../lib/automaticTransactionDefaultsApi';
import { AutomaticTransactionSettings } from './AutomaticTransactionSettings';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false }));

const familyId = 'family-automatic-settings';
const catalogs = {
  purposes: [
    { id: 'purpose-investment', name: 'Đầu tư' },
    { id: 'purpose-family', name: 'Sinh hoạt gia đình' },
  ],
  expenseTypes: [
    { id: 'expense-savings', name: 'Gửi tiết kiệm' },
    { id: 'expense-interest', name: 'Lãi tiền gửi' },
    { id: 'expense-withdrawal', name: 'Rút tiết kiệm' },
    { id: 'expense-fee', name: 'Phí tiết kiệm' },
    { id: 'expense-settlement', name: 'Tất toán tiết kiệm' },
    { id: 'expense-gold', name: 'Đầu tư vàng' },
    { id: 'expense-other', name: 'Khác' },
  ],
  paymentMethods: [
    { id: 'payment-bank', name: 'Chuyển khoản' },
    { id: 'payment-cash', name: 'Tiền mặt' },
  ],
};

function renderSettings(role: 'owner' | 'member' = 'owner') {
  vi.mocked(useApp).mockReturnValue({
    familyId,
    currentUserRole: role,
    ...catalogs,
    online: true,
  } as unknown as ReturnType<typeof useApp>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <FeedbackProvider>
      <QueryClientProvider client={queryClient}>
        <AutomaticTransactionSettings />
      </QueryClientProvider>
    </FeedbackProvider>,
  );
}

describe('cấu hình giao dịch tự động', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('cho owner cấu hình riêng mục đích, danh mục và phương thức thanh toán', async () => {
    renderSettings();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mặc định giao dịch tự động' })).toBeInTheDocument());
    expect(screen.getByLabelText('Mục đích', { selector: '#gold_sale-purpose' })).toHaveValue('purpose-investment');
    expect(screen.getByLabelText('Danh mục', { selector: '#savings_interest-expense-type' })).toHaveValue('expense-interest');
    expect(screen.getByLabelText('Phương thức thanh toán', { selector: '#gold_sale-payment-method' })).toHaveValue('payment-cash');
    expect(screen.queryByRole('heading', { name: 'Rút tiền tiết kiệm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Phí sổ tiết kiệm' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mục đích', { selector: '#gold_sale-purpose' }), { target: { value: 'purpose-family' } });
    fireEvent.change(screen.getByLabelText('Danh mục', { selector: '#gold_sale-expense-type' }), { target: { value: 'expense-other' } });
    fireEvent.change(screen.getByLabelText('Phương thức thanh toán', { selector: '#gold_sale-payment-method' }), { target: { value: 'payment-bank' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mặc định tự động' }));

    await waitFor(() => expect(screen.getByText('Đã lưu cấu hình giao dịch tự động.')).toBeInTheDocument());
    const stored = JSON.parse(localStorage.getItem(automaticTransactionDefaultsStorageKey(familyId)) || '[]') as Array<Record<string, string>>;
    expect(stored.find((item) => item.automationKey === 'gold_sale')).toMatchObject({
      purposeId: 'purpose-family',
      expenseTypeId: 'expense-other',
      paymentMethodId: 'payment-bank',
    });
  });

  it('giữ cấu hình ở chế độ chỉ xem cho member', async () => {
    renderSettings('member');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mặc định giao dịch tự động' })).toBeInTheDocument());
    expect(screen.getByText(/Chỉ chủ gia đình có thể thay đổi các mặc định dùng chung/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu mặc định tự động' })).toBeDisabled();
    expect(screen.getByLabelText('Mục đích', { selector: '#gold_sale-purpose' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Rút tiền tiết kiệm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Phí sổ tiết kiệm' })).not.toBeInTheDocument();
  });
});

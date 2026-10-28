import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './AppContext';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

function Probe() {
  const { familyId, currentUserEmail, currentUserDisplayName, purposes, addCatalogItem, deleteFamily } = useApp();
  return (
    <div>
      <output data-testid="family-id">{familyId}</output>
      <output data-testid="demo-email">{currentUserEmail}</output>
      <output data-testid="demo-display-name">{currentUserDisplayName}</output>
      <ul>{purposes.map((item) => <li key={item.id}>{item.name} {item.nameEn}</li>)}</ul>
      <button type="button" onClick={() => void addCatalogItem('purpose', 'Mục mới', 'New purpose', 'tag')}>
        Thêm mục demo
      </button>
      <button type="button" onClick={() => void deleteFamily()}>
        Xóa gia đình demo
      </button>
    </div>
  );
}

function PersistenceProbe() {
  const { purposes, transactions, addCatalogItem, setTransactions } = useApp();
  return (
    <div>
      <output data-testid="purpose-count">{purposes.length}</output>
      <output data-testid="transaction-count">{transactions.length}</output>
      <button type="button" onClick={() => void addCatalogItem('purpose', 'Danh mục bền vững')}>Thêm danh mục bền vững</button>
      <button type="button" onClick={() => setTransactions([{ id: 'local-transaction', familyId: 'local-family', transactionDate: '2026-08-25', transactionType: 'Chi tiêu', status: 'Thực tế', description: 'Giao dịch bền vững', amount: 100000, purposeId: 'purpose-1', expenseTypeId: 'expense-1', paymentMethodId: 'payment-1', note: null, source: 'manual', sourceReference: null, aiGenerated: false }])}>Thêm giao dịch bền vững</button>
      <span>{purposes.some((item) => item.name === 'Danh mục bền vững') ? 'Đã có danh mục bền vững' : ''}</span>
      <span>{transactions.some((item) => item.description === 'Giao dịch bền vững') ? 'Đã có giao dịch bền vững' : ''}</span>
    </div>
  );
}

describe('AppProvider demo fallback', () => {
  it('giữ danh mục và giao dịch demo sau khi khởi tạo lại provider', async () => {
    localStorage.clear();
    const first = render(<AppProvider><PersistenceProbe /></AppProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm danh mục bền vững' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm giao dịch bền vững' }));
    await waitFor(() => expect(screen.getByText('Đã có giao dịch bền vững')).toBeInTheDocument());
    first.unmount();

    render(<AppProvider><PersistenceProbe /></AppProvider>);
    expect(await screen.findByText('Đã có danh mục bền vững')).toBeInTheDocument();
    expect(screen.getByText('Đã có giao dịch bền vững')).toBeInTheDocument();
    localStorage.clear();
  });

  it('mở thẳng không gian demo và thêm danh mục mà không gọi Supabase', async () => {
    render(<AppProvider><Probe /></AppProvider>);

    expect(screen.getByTestId('family-id')).toHaveTextContent('local-family');
    expect(screen.getByTestId('demo-email')).toHaveTextContent('demo@family.local');
    expect(screen.getByTestId('demo-display-name')).toHaveTextContent('Chủ gia đình');

    fireEvent.click(screen.getByRole('button', { name: 'Thêm mục demo' }));

    await waitFor(() => expect(screen.getByText(/Mục mới/)).toHaveTextContent('New purpose'));
  });

  it('xóa gia đình demo và dữ liệu local theo family nhưng giữ tùy chọn giao diện', async () => {
    localStorage.setItem('family-expense:savings-accounts:local-family', '[]');
    localStorage.setItem('family-expense:transaction-draft:local-family', '{}');
    localStorage.setItem('family-expense-language', 'en');
    localStorage.setItem('family-expense-theme', 'dark');
    localStorage.setItem('family-expense-budget-notifications', JSON.stringify([
      { familyId: 'local-family', id: 'demo-notification' },
      { familyId: 'other-family', id: 'other-notification' },
    ]));

    render(<AppProvider><Probe /></AppProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa gia đình demo' }));

    await waitFor(() => expect(screen.getByTestId('family-id')).toHaveTextContent(''));
    expect(localStorage.getItem('family-expense:savings-accounts:local-family')).toBeNull();
    expect(localStorage.getItem('family-expense:transaction-draft:local-family')).toBeNull();
    expect(localStorage.getItem('family-expense-language')).toBe('en');
    expect(localStorage.getItem('family-expense-theme')).toBe('dark');
    expect(localStorage.getItem('family-expense-budget-notifications')).toBe(
      JSON.stringify([{ familyId: 'other-family', id: 'other-notification' }]),
    );
  });
});

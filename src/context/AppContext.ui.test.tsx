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

describe('AppProvider demo fallback', () => {
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

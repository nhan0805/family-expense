import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './AppContext';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

function Probe() {
  const { familyId, currentUserEmail, purposes, addCatalogItem } = useApp();
  return (
    <div>
      <output data-testid="family-id">{familyId}</output>
      <output data-testid="demo-email">{currentUserEmail}</output>
      <ul>{purposes.map((item) => <li key={item.id}>{item.name} {item.nameEn}</li>)}</ul>
      <button type="button" onClick={() => void addCatalogItem('purpose', 'Mục mới', 'New purpose', 'tag')}>
        Thêm mục demo
      </button>
    </div>
  );
}

describe('AppProvider demo fallback', () => {
  it('mở thẳng không gian demo và thêm danh mục mà không gọi Supabase', async () => {
    render(<AppProvider><Probe /></AppProvider>);

    expect(screen.getByTestId('family-id')).toHaveTextContent('local-family');
    expect(screen.getByTestId('demo-email')).toHaveTextContent('demo@family.local');

    fireEvent.click(screen.getByRole('button', { name: 'Thêm mục demo' }));

    await waitFor(() => expect(screen.getByText(/Mục mới/)).toHaveTextContent('New purpose'));
  });
});
